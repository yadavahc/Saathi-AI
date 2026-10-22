"""Thread-safe data store.

Local seeded data is the source of truth at runtime; when Google Sheets is
configured every write is mirrored to the matching worksheet (write-through),
and on startup sheets that already hold data override the seed.
"""
from __future__ import annotations

import copy
import json
import threading
from typing import Any, Callable

from backend.config import settings
from backend.utils.helpers import day_offset, get_logger

log = get_logger("store")

# Sheet name -> primary key column. These are mirrored to Google Sheets.
SHEETS: dict[str, str] = {
    "Users": "user_id",
    "Transactions": "txn_id",
    "Financial Data": "user_id",
    "Recurring Payments": "rp_id",
    "Merchants": "merchant_id",
    "Inventory": "sku",
    "Sales": "sale_id",
    "Expenses": "expense_id",
    "Customer Credit": "customer_id",
    "Orders": "order_id",
    "Suppliers": "supplier_id",
    "Campaigns": "campaign_id",
    "Fraud Cases": "case_id",
    "Cash Reconciliation": "recon_id",
    "Payment Predictions": "prediction_id",
    "Activity Logs": "log_id",
    "Approvals": "approval_id",
}

# Runtime-only tables (not mirrored).
LOCAL_TABLES: dict[str, str] = {
    "Calls": "call_id",
    "Insurance Claims": "claim_id",
    "Payment Plans": "plan_id",
    "Outbox": "message_id",
    "Agent Runs": "run_id",
    "Shield Sessions": "session_id",
    "Documents": "doc_id",
}

# Human-friendly sequential ids. Seeded so the demo produces the ids in the brief.
ID_COUNTERS_SEED = {
    "CLM": 2041,
    "FRD": 1101,
    "PO": 3051,
    "ORD": 7721,
    "CMP": 501,
    "PLN": 801,
    "PRD": 601,
    "REC": 401,
    "APR": 1001,
    "LOG": 1,
    "RUN": 1,
    "CALL": 301,
    "MSG": 1,
    "TXN": 9001,
    "SHD": 101,
    "DOC": 201,
    "CUS": 4,
}


def _file_name(sheet: str) -> str:
    return sheet.lower().replace(" ", "_") + ".json"


def _resolve_dates(row: dict) -> dict:
    """Seed rows store relative dates as `*_in_days` / `days_ago` for evergreen demos."""
    out = dict(row)
    for key in list(out):
        if key.endswith("_in_days") and isinstance(out[key], int):
            out[key.replace("_in_days", "_date")] = day_offset(out[key])
        if key == "days_ago" and isinstance(out[key], int):
            out["date"] = day_offset(-out[key])
    return out


class DataStore:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self.tables: dict[str, list[dict]] = {}
        self.counters: dict[str, int] = {}
        self._listeners: list[Callable[[str, str, dict], None]] = []
        self._reset_listeners: list[Callable[[], None]] = []
        self.version = 0
        self.reset()

    # ── lifecycle ──────────────────────────────────────────────────────────
    def reset(self) -> None:
        with self._lock:
            self.tables = {}
            for sheet in {**SHEETS, **LOCAL_TABLES}:
                path = settings.seed_dir / _file_name(sheet)
                rows = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
                self.tables[sheet] = [_resolve_dates(r) for r in rows]
            self.counters = dict(ID_COUNTERS_SEED)
            self.version += 1
        log.info("Store loaded from seed (%d tables)", len(self.tables))
        for listener in getattr(self, "_reset_listeners", []):
            listener()

    def on_reset(self, listener: Callable[[], None]) -> None:
        self._reset_listeners.append(listener)

    def replace_table(self, sheet: str, rows: list[dict]) -> None:
        with self._lock:
            self.tables[sheet] = rows
            self.version += 1

    def on_write(self, listener: Callable[[str, str, dict], None]) -> None:
        self._listeners.append(listener)

    def _emit(self, op: str, sheet: str, row: dict) -> None:
        self.version += 1
        if sheet not in SHEETS:
            return
        for listener in self._listeners:
            try:
                listener(op, sheet, copy.deepcopy(row))
            except Exception as exc:  # listeners must never break a write
                log.warning("store listener failed: %s", exc)

    # ── ids ────────────────────────────────────────────────────────────────
    def next_id(self, prefix: str) -> str:
        with self._lock:
            value = self.counters.get(prefix, 1)
            self.counters[prefix] = value + 1
            return f"{prefix}-{value}"

    # ── reads ──────────────────────────────────────────────────────────────
    def all(self, sheet: str, **filters: Any) -> list[dict]:
        with self._lock:
            rows = self.tables.get(sheet, [])
            return [copy.deepcopy(r) for r in rows if all(r.get(k) == v for k, v in filters.items())]

    def find(self, sheet: str, **filters: Any) -> dict | None:
        rows = self.all(sheet, **filters)
        return rows[0] if rows else None

    def get(self, sheet: str, key: str) -> dict | None:
        pk = {**SHEETS, **LOCAL_TABLES}[sheet]
        return self.find(sheet, **{pk: key})

    # ── writes ─────────────────────────────────────────────────────────────
    def insert(self, sheet: str, row: dict) -> dict:
        with self._lock:
            self.tables.setdefault(sheet, []).append(copy.deepcopy(row))
            self._emit("insert", sheet, row)
        return row

    def update(self, sheet: str, key: str, changes: dict) -> dict:
        pk = {**SHEETS, **LOCAL_TABLES}[sheet]
        with self._lock:
            for row in self.tables.get(sheet, []):
                if row.get(pk) == key:
                    row.update(copy.deepcopy(changes))
                    self._emit("update", sheet, row)
                    return copy.deepcopy(row)
        raise KeyError(f"{sheet}: no row with {pk}={key}")

    def mutate(self, sheet: str, key: str, fn: Callable[[dict], None]) -> dict:
        """Apply an in-place mutation (e.g. append to a nested list) atomically."""
        pk = {**SHEETS, **LOCAL_TABLES}[sheet]
        with self._lock:
            for row in self.tables.get(sheet, []):
                if row.get(pk) == key:
                    fn(row)
                    self._emit("update", sheet, row)
                    return copy.deepcopy(row)
        raise KeyError(f"{sheet}: no row with {pk}={key}")


store = DataStore()
