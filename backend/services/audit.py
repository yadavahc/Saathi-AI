"""Audit trail: every important decision, tool call and action is logged."""
from __future__ import annotations

from typing import Any

from backend.services.store import store
from backend.utils.helpers import get_logger, now_iso

log = get_logger("audit")


def _short(value: Any, limit: int = 400) -> Any:
    text = str(value)
    return value if len(text) <= limit else text[:limit] + "…"


def record(
    message: str,
    *,
    agent: str = "system",
    tool: str = "",
    intent: str = "",
    user: str = "",
    input: Any = None,
    decision: str = "",
    approval: str = "",
    result: Any = None,
    status: str = "INFO",
    kind: str = "event",
    run_id: str = "",
) -> dict:
    entry = {
        "log_id": store.next_id("LOG"),
        "timestamp": now_iso(),
        "user": user,
        "intent": intent,
        "agent": agent,
        "tool": tool,
        "input": _short(input) if input is not None else "",
        "decision": decision,
        "approval": approval,
        "result": _short(result) if result is not None else "",
        "status": status,
        "kind": kind,
        "message": message,
        "run_id": run_id,
    }
    store.insert("Activity Logs", entry)
    log.info("[%s] %s%s", status, message, f" ({tool})" if tool else "")
    return entry


def recent(limit: int = 60, include_reads: bool = True) -> list[dict]:
    rows = store.all("Activity Logs")
    if not include_reads:
        rows = [r for r in rows if r.get("kind") != "tool_read"]
    return list(reversed(rows[-limit:]))
