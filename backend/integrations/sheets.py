"""Google Sheets — the hackathon data backend.

If `GOOGLE_SHEETS_ID` + `GOOGLE_SERVICE_ACCOUNT_FILE` are set, SAATHI:
  * creates any missing worksheet (one per table) and seeds it,
  * loads existing rows on startup (the sheet wins over the seed),
  * mirrors every insert/update. Writes are batched into a single
    `values.batchUpdate` request every few seconds — Sheets allows ~60 write
    requests/minute, and a demo produces hundreds of row changes,
  * re-seeds all sheets when the demo world is reset.
Otherwise it silently stays on local seeded data (fallback).
"""
from __future__ import annotations

import json
import queue
import re
import threading
import time
from pathlib import Path

from backend.config import ROOT, settings
from backend.services.store import SHEETS, store
from backend.utils.helpers import get_logger

log = get_logger("sheets")

FLUSH_SECONDS = 3.0
MIN_ROWS = 5000
ID_PATTERN = re.compile(r"^([A-Z]+)-(\d+)$")


def _cell(value):
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    if value is None:
        return ""
    return value


def _parse(value):
    if value == "":
        return None
    if value in ("TRUE", "FALSE"):
        return value == "TRUE"
    if isinstance(value, str) and value[:1] in "[{":
        try:
            return json.loads(value)
        except ValueError:
            return value
    return value


def _col(n: int) -> str:
    out = ""
    while n:
        n, r = divmod(n - 1, 26)
        out = chr(65 + r) + out
    return out


class SheetsMirror:
    def __init__(self) -> None:
        self.enabled = False
        self.status = "simulated"
        self.detail = "Using local seeded data (Google Sheets not configured)."
        self.writes = 0
        self._book = None
        self._headers: dict[str, list[str]] = {}
        self._index: dict[str, dict[str, int]] = {}  # sheet -> primary key -> row number
        self._next_row: dict[str, int] = {}
        self._queue: queue.Queue = queue.Queue()

    # ── startup ────────────────────────────────────────────────────────────
    def start(self) -> None:
        if not (settings.google_sheets_id and settings.google_service_account_file):
            return
        try:
            import gspread

            cred_path = Path(settings.google_service_account_file)
            if not cred_path.is_absolute():
                cred_path = ROOT / cred_path
            client = gspread.service_account(filename=str(cred_path))
            self._book = client.open_by_key(settings.google_sheets_id)
            loaded = self._sync_on_startup()
            self.enabled = True
            self.status = "live"
            self.detail = f"'{self._book.title}' · {len(SHEETS)} sheets · " + ("loaded existing data" if loaded else "seeded")
            store.on_write(lambda op, sheet, row: self._queue.put(("row", sheet, row)))
            store.on_reset(lambda: self._queue.put(("reset", None, None)))
            threading.Thread(target=self._worker, daemon=True, name="sheets-writer").start()
            log.info("Google Sheets connected: %s", self.detail)
        except Exception as exc:
            self.status = "fallback"
            self.detail = f"Google Sheets unavailable ({exc.__class__.__name__}); using local data."
            log.warning("Google Sheets disabled: %s", exc)

    def _headers_for(self, sheet: str, rows: list[dict]) -> list[str]:
        pk = SHEETS[sheet]
        keys = []
        for row in rows:
            keys += [k for k in row if k not in keys]
        return [pk] + [k for k in keys if k != pk]

    def _sync_on_startup(self) -> bool:
        existing = {ws.title: ws for ws in self._book.worksheets()}
        data_found = False
        to_seed: list[str] = []
        for sheet in SHEETS:
            ws = existing.get(sheet)
            if ws is None:
                ws = self._book.add_worksheet(title=sheet, rows=MIN_ROWS, cols=30)
                to_seed.append(sheet)
                continue
            if ws.row_count < MIN_ROWS:
                ws.resize(rows=MIN_ROWS)
            records = ws.get_all_records()
            if not records:
                to_seed.append(sheet)
                continue
            data_found = True
            rows = [{k: _parse(v) for k, v in r.items()} for r in records]
            store.replace_table(sheet, rows)
            self._headers[sheet] = ws.row_values(1)
            pk = SHEETS[sheet]
            self._index[sheet] = {str(r.get(pk)): i + 2 for i, r in enumerate(rows)}
            self._next_row[sheet] = len(rows) + 2
            self._bump_counters(rows, pk)
        if to_seed:
            self._write_full(to_seed)
        return data_found

    @staticmethod
    def _bump_counters(rows: list[dict], pk: str) -> None:
        for row in rows:
            match = ID_PATTERN.match(str(row.get(pk, "")))
            if match:
                prefix, num = match.group(1), int(match.group(2))
                if store.counters.get(prefix, 0) <= num:
                    store.counters[prefix] = num + 1

    def _write_full(self, sheets: list[str]) -> None:
        """Clear and rewrite whole sheets from the store in two API calls."""
        self._book.values_batch_clear(body={"ranges": [f"'{s}'!A1:ZZ{MIN_ROWS}" for s in sheets]})
        data = []
        for sheet in sheets:
            rows = store.all(sheet)
            headers = self._headers_for(sheet, rows)
            self._headers[sheet] = headers
            pk = SHEETS[sheet]
            self._index[sheet] = {str(r.get(pk)): i + 2 for i, r in enumerate(rows)}
            self._next_row[sheet] = len(rows) + 2
            data.append({"range": f"'{sheet}'!A1", "values": [headers] + [[_cell(r.get(h)) for h in headers] for r in rows]})
        self._book.values_batch_update(body={"valueInputOption": "RAW", "data": data})
        self.writes += 2

    # ── batched writer ─────────────────────────────────────────────────────
    def _worker(self) -> None:
        while True:
            first = self._queue.get()
            batch = [first]
            deadline = time.time() + FLUSH_SECONDS
            while time.time() < deadline:
                try:
                    batch.append(self._queue.get(timeout=max(0.05, deadline - time.time())))
                except queue.Empty:
                    break
            try:
                self._flush(batch)
            except Exception as exc:
                log.warning("Sheets flush failed (%d ops): %s", len(batch), exc)
                time.sleep(5)

    def _flush(self, batch: list[tuple]) -> None:
        # A reset invalidates everything queued before it.
        last_reset = max((i for i, op in enumerate(batch) if op[0] == "reset"), default=-1)
        if last_reset >= 0:
            self._write_full(list(SHEETS))
            batch = batch[last_reset + 1:]
        latest: dict[tuple[str, str], dict] = {}
        for _, sheet, row in batch:
            latest[(sheet, str(row.get(SHEETS[sheet])))] = row  # keep only the newest version of each row
        if not latest:
            return
        data = []
        header_changed: set[str] = set()
        for (sheet, key), row in latest.items():
            headers = self._headers.setdefault(sheet, [SHEETS[sheet]])
            for k in row:
                if k not in headers:
                    headers.append(k)
                    header_changed.add(sheet)
            index = self._index.setdefault(sheet, {})
            if key not in index:
                index[key] = self._next_row.get(sheet, 2)
                self._next_row[sheet] = index[key] + 1
            data.append({"range": f"'{sheet}'!A{index[key]}:{_col(len(headers))}{index[key]}",
                         "values": [[_cell(row.get(h)) for h in headers]]})
        for sheet in header_changed:
            data.append({"range": f"'{sheet}'!A1", "values": [self._headers[sheet]]})
        self._book.values_batch_update(body={"valueInputOption": "RAW", "data": data})
        self.writes += 1


sheets = SheetsMirror()
