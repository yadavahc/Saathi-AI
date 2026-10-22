"""Tool orchestrator.

Every tool:
  1. validates its inputs (pydantic `validate_call`)
  2. performs the operation
  3. returns a structured JSON envelope
  4. updates relevant data (inside the tool body, via the store)
  5. creates an activity log entry
  6. updates the dashboard (store version bump + run trace)
  7. handles errors (never raises to the caller)
"""
from __future__ import annotations

import functools
import time
from dataclasses import dataclass
from typing import Any, Callable

from pydantic import ValidationError, validate_call

from backend.services import audit, flow
from backend.utils.helpers import now_iso


class ToolError(Exception):
    """Expected, user-facing failure (bad state, missing record)."""


@dataclass
class ToolSpec:
    name: str
    agent: str
    mutates: bool
    description: str
    fn: Callable[..., dict]


TOOLS: dict[str, ToolSpec] = {}


def _summary(data: Any) -> str:
    if isinstance(data, dict):
        if "summary" in data:
            return str(data["summary"])
        keys = list(data)[:4]
        return ", ".join(f"{k}={data[k]}" for k in keys if not isinstance(data[k], (list, dict)))[:160]
    return str(data)[:160]


def tool(name: str, agent: str, mutates: bool = False):
    def deco(fn: Callable[..., dict]):
        validated = validate_call(fn)

        @functools.wraps(fn)
        def run(**kwargs: Any) -> dict:
            started = time.perf_counter()
            run_id = flow.current_run_id()
            try:
                data = validated(**kwargs)
                status = "SUCCESS"
                error = None
            except ValidationError as exc:
                data, status, error = None, "INVALID_INPUT", exc.errors(include_url=False)
            except ToolError as exc:
                data, status, error = None, "FAILED", str(exc)
            except Exception as exc:  # unexpected — keep the agent loop alive
                data, status, error = None, "ERROR", f"{exc.__class__.__name__}: {exc}"
            envelope = {
                "tool": name,
                "agent": agent,
                "status": status,
                "data": data,
                "error": error,
                "simulated": bool(isinstance(data, dict) and data.get("simulated")),
                "duration_ms": round((time.perf_counter() - started) * 1000, 1),
                "timestamp": now_iso(),
            }
            summary = _summary(data) if data is not None else str(error)
            audit.record(
                f"{name}() → {status}" + (f": {summary}" if summary else ""),
                agent=agent,
                tool=name,
                input=kwargs,
                result=summary,
                status=status,
                kind="tool_write" if mutates else "tool_read",
                run_id=run_id or "",
            )
            flow.add_tool(run_id, name, status, summary, mutates)
            return envelope

        TOOLS[name] = ToolSpec(name=name, agent=agent, mutates=mutates, description=(fn.__doc__ or "").strip(), fn=run)
        return run

    return deco


def call(name: str, **kwargs: Any) -> dict:
    if name not in TOOLS:
        return {"tool": name, "status": "ERROR", "data": None, "error": "unknown tool"}
    return TOOLS[name].fn(**kwargs)


def ok(envelope: dict) -> dict:
    """Unwrap a successful tool result or raise ToolError for the agent to handle."""
    if envelope["status"] != "SUCCESS":
        raise ToolError(f"{envelope['tool']} failed: {envelope['error']}")
    return envelope["data"]
