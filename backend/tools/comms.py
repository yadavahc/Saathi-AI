"""Shared communication tools."""
from __future__ import annotations

from backend.integrations.telegram import telegram
from backend.tools.registry import tool


@tool("send_telegram", "system", mutates=True)
def send_telegram(role: str, title: str, text: str) -> dict:
    """Send a Telegram message (dashboard outbox when Telegram is unavailable)."""
    message = telegram.send(role=role, title=title, text=text)
    return {"message_id": message["message_id"], "queued_for_telegram": message["will_deliver"], "simulated": message["simulated"],
            "summary": "sent to Telegram" if message["will_deliver"] else "shown in dashboard outbox"}


@tool("transfer_to_human", "system", mutates=True)
def transfer_to_human(reason: str, user_id: str) -> dict:
    """Escalate to a human agent."""
    message = telegram.send(role="user", title="Human handoff",
                            text=f"👤 A SAATHI specialist will contact you shortly.\nReason: {reason}")
    return {"ticket": message["message_id"], "reason": reason, "simulated": True, "summary": "Escalated to human specialist"}
