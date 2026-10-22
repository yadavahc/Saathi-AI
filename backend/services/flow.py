"""Agent run trace — powers the "what you said → what SAATHI verified" view.

A run moves through fixed stages. Tools executed while a run is bound (via the
`bind` context manager) are attached to it automatically.
"""
from __future__ import annotations

import contextlib
import contextvars
from typing import Any, Iterator

from backend.services.store import store
from backend.utils.helpers import now_iso

STAGES = ["SAID", "UNDERSTOOD", "DATA", "DECIDED", "APPROVAL", "TOOL", "ACTION", "VERIFIED"]

_current_run: contextvars.ContextVar[str | None] = contextvars.ContextVar("saathi_run", default=None)


def current_run_id() -> str | None:
    return _current_run.get()


@contextlib.contextmanager
def bind(run_id: str | None) -> Iterator[None]:
    token = _current_run.set(run_id)
    try:
        yield
    finally:
        _current_run.reset(token)


def start(said: str, *, source: str, user_id: str, channel: str = "text", language: str = "en") -> dict:
    run = {
        "run_id": store.next_id("RUN"),
        "started_at": now_iso(),
        "source": source,
        "channel": channel,
        "user_id": user_id,
        "said": said,
        "language": language,
        "understood": None,
        "data": [],
        "decision": "",
        "approval": {"required": False, "status": "NOT_REQUIRED", "approval_ids": []},
        "tools": [],
        "action": "",
        "verified": "",
        "status": "RUNNING",
        "stage": "SAID",
        "reply": "",
        "agents": [],
    }
    store.insert("Agent Runs", run)
    return run


def get(run_id: str) -> dict | None:
    return store.get("Agent Runs", run_id)


def update(run_id: str | None, **changes: Any) -> None:
    if not run_id or not get(run_id):
        return
    store.update("Agent Runs", run_id, changes)


def stage(run_id: str | None, name: str, **changes: Any) -> None:
    update(run_id, stage=name, **changes)


def add_data(run_id: str | None, label: str, value: Any) -> None:
    if not run_id or not get(run_id):
        return

    def _add(row: dict) -> None:
        row["data"].append({"label": label, "value": value})

    store.mutate("Agent Runs", run_id, _add)


def add_tool(run_id: str | None, name: str, status: str, summary: str, mutates: bool) -> None:
    if not run_id or not get(run_id):
        return

    def _add(row: dict) -> None:
        row["tools"].append({"name": name, "status": status, "summary": summary, "mutates": mutates, "ts": now_iso()})

    store.mutate("Agent Runs", run_id, _add)


def link_approval(run_id: str | None, approval_id: str) -> None:
    if not run_id or not get(run_id):
        return

    def _add(row: dict) -> None:
        row["approval"]["required"] = True
        row["approval"]["status"] = "PENDING"
        row["approval"]["approval_ids"].append(approval_id)

    store.mutate("Agent Runs", run_id, _add)


def recent(limit: int = 12) -> list[dict]:
    return list(reversed(store.all("Agent Runs")[-limit:]))
