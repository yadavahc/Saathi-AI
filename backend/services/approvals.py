"""Approval engine. Sensitive actions only execute after explicit approval.

Agents *propose* actions; this module turns proposals into standardized
approval objects (status PENDING). Executing an approval runs the registered
action handler, verifies the outcome against stored state, and records
everything in the audit trail. No approval → no execution.
"""
from __future__ import annotations

import threading
from typing import Any, Callable

from backend.services import audit, flow
from backend.services.store import store
from backend.utils.helpers import get_logger, now_iso

log = get_logger("approvals")

# action name -> handler(params, approval) -> {"summary", "verified", "verification", "steps", "status"?}
ACTION_HANDLERS: dict[str, Callable[[dict, dict], dict]] = {}
_events: dict[str, threading.Event] = {}
_hooks: dict[str, list[Callable[[dict], None]]] = {"proposed": [], "decided": []}
_exec_lock = threading.Lock()


def handler(action: str):
    def deco(fn):
        ACTION_HANDLERS[action] = fn
        return fn

    return deco


def on(event: str, fn: Callable[[dict], None]) -> None:
    _hooks[event].append(fn)


def _fire(event: str, approval: dict) -> None:
    for fn in _hooks[event]:
        try:
            fn(approval)
        except Exception as exc:
            log.warning("approval hook %s failed: %s", event, exc)


def propose(
    *,
    action: str,
    description: str,
    agent: str,
    params: dict,
    amount: float | None = None,
    impact: str = "",
    target: str = "",
    reason: str = "",
    user_id: str = "",
    run_id: str | None = None,
    simulated: bool = True,
) -> dict:
    approval = {
        "approval_id": store.next_id("APR"),
        "action": action,
        "description": description,
        "amount": amount,
        "impact": impact,
        "target": target,
        "reason": reason,
        "requires_confirmation": True,
        "status": "PENDING",
        "agent": agent,
        "user_id": user_id,
        "params": params,
        "run_id": run_id or "",
        "simulated": simulated,
        "created_at": now_iso(),
        "decided_at": "",
        "decided_by": "",
        "channel": "",
        "result": None,
    }
    store.insert("Approvals", approval)
    _events[approval["approval_id"]] = threading.Event()
    flow.link_approval(run_id, approval["approval_id"])
    audit.record(
        f"Approval requested: {description}",
        agent=agent,
        tool=action,
        approval=approval["approval_id"],
        decision="REQUIRES_APPROVAL",
        status="PENDING",
        kind="approval",
        run_id=run_id or "",
        user=user_id,
    )
    _fire("proposed", approval)
    return approval


def pending() -> list[dict]:
    return [a for a in store.all("Approvals") if a["status"] == "PENDING"]


def decide(approval_id: str, approve: bool, *, by: str = "user", channel: str = "dashboard") -> dict:
    """Approve (and execute) or reject an approval. Idempotent."""
    with _exec_lock:
        approval = store.get("Approvals", approval_id)
        if not approval:
            raise KeyError(f"Unknown approval {approval_id}")
        if approval["status"] != "PENDING":
            return approval
        status = "APPROVED" if approve else "REJECTED"
        approval = store.update(
            "Approvals",
            approval_id,
            {"status": status, "decided_at": now_iso(), "decided_by": by, "channel": channel},
        )
    run_id = approval.get("run_id") or None
    _fire("decided", approval)
    audit.record(
        f"{'Approved' if approve else 'Rejected'} by {by} via {channel}: {approval['description']}",
        agent=approval["agent"],
        tool=approval["action"],
        approval=approval_id,
        decision=status,
        status=status,
        kind="approval",
        run_id=run_id or "",
        user=approval.get("user_id", ""),
    )
    if not approve:
        flow.update(run_id, approval={**_run_approval(run_id), "status": "REJECTED"}, stage="APPROVAL", status="CANCELLED",
                    action="No action taken — user declined.")
        return _finish(approval_id)

    flow.update(run_id, approval={**_run_approval(run_id), "status": "APPROVED"}, stage="TOOL")
    fn = ACTION_HANDLERS.get(approval["action"])
    if fn is None:
        store.update("Approvals", approval_id, {"status": "FAILED", "result": {"error": "no handler"}})
        return _finish(approval_id)
    with flow.bind(run_id):
        try:
            result = fn(approval["params"], approval)
        except Exception as exc:
            log.exception("Action %s failed", approval["action"])
            result = {"summary": f"Action failed: {exc}", "verified": False, "verification": "Execution error", "steps": []}
    final_status = result.get("status") or ("EXECUTED" if result.get("verified") else "FAILED")
    store.update("Approvals", approval_id, {"status": final_status, "result": result})
    flow.update(
        run_id,
        stage="VERIFIED" if final_status == "EXECUTED" else "ACTION",
        action=result.get("summary", ""),
        verified=result.get("verification", ""),
        status="COMPLETED" if final_status == "EXECUTED" else final_status,
    )
    audit.record(
        f"Action {final_status.lower()}: {result.get('summary', '')}",
        agent=approval["agent"],
        tool=approval["action"],
        approval=approval_id,
        decision=final_status,
        result=result.get("verification", ""),
        status="SUCCESS" if final_status == "EXECUTED" else final_status,
        kind="action",
        run_id=run_id or "",
    )
    return _finish(approval_id)


def complete_async(approval_id: str, result: dict) -> None:
    """Called when an action that waited on a third party (e.g. supplier) finishes."""
    approval = store.get("Approvals", approval_id)
    if not approval:
        return
    final_status = "EXECUTED" if result.get("verified") else "FAILED"
    store.update("Approvals", approval_id, {"status": final_status, "result": result})
    run_id = approval.get("run_id") or None
    flow.update(run_id, stage="VERIFIED", action=result.get("summary", ""), verified=result.get("verification", ""),
                status="COMPLETED" if final_status == "EXECUTED" else final_status)
    _finish(approval_id)


def _run_approval(run_id: str | None) -> dict:
    run = flow.get(run_id) if run_id else None
    return run["approval"] if run else {"required": True, "approval_ids": []}


def _finish(approval_id: str) -> dict:
    approval = store.get("Approvals", approval_id)
    if approval and approval["status"] not in {"PENDING", "AWAITING_THIRD_PARTY"}:
        event = _events.get(approval_id)
        if event:
            event.set()
    return approval


def wait(approval_id: str, timeout: float) -> dict | None:
    """Block until an approval leaves PENDING / AWAITING states (used by demo runner)."""
    event = _events.setdefault(approval_id, threading.Event())
    event.wait(timeout)
    return store.get("Approvals", approval_id)


def as_card(approval: dict) -> dict[str, Any]:
    keys = ["approval_id", "action", "description", "amount", "impact", "target", "reason",
            "requires_confirmation", "status", "agent", "simulated", "created_at", "result"]
    return {k: approval.get(k) for k in keys}
