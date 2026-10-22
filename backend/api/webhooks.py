"""Inbound webhooks: Vobiz (phone call) and Telegram (buttons/messages)."""
from __future__ import annotations

from fastapi import APIRouter, Request, Response

from backend.agents import actions
from backend.config import settings
from backend.integrations.sarvam import sarvam
from backend.integrations.telegram import telegram
from backend.integrations.vobiz import vobiz
from backend.models.schemas import SimulateResponse
from backend.services import audit, calls
from backend.services.store import store

router = APIRouter(prefix="/api")

# "Press 1 for yes, 2 for no" — keypad fallback for noisy lines.
KEYPAD_HINT = "ಹೌದು ಅಂದ್ರೆ ಒಂದು, ಇಲ್ಲ ಅಂದ್ರೆ ಎರಡು ಒತ್ತಿ."


def _latest_saathi_line(call_id: str) -> tuple[str, str | None]:
    call_row = store.get("Calls", call_id) or {"transcript": []}
    line = next((t for t in reversed(call_row["transcript"]) if t["speaker"] == "SAATHI"), {"speech_text": "Namaskara", "audio_url": None})
    audio = f"{settings.public_base_url}{line['audio_url']}" if line.get("audio_url") and settings.public_base_url else None
    if not audio:
        audio_id = sarvam.speak(line["speech_text"], "kn-IN")
        audio = f"{settings.public_base_url}/api/audio/{audio_id}" if audio_id and settings.public_base_url else None
    return line["speech_text"], audio


@router.post("/vobiz/webhook")
async def vobiz_webhook(request: Request, call_id: str, step: str = "start", attempt: int = 0) -> Response:
    form = dict(await request.form()) if "form" in request.headers.get("content-type", "") else {}
    audit.record(f"Vobiz webhook step={step} attempt={attempt} input={form.get('Digits') or form.get('Speech') or '-'}",
                 agent="financial_safety", tool="vobiz_webhook", status="INFO", kind="call")
    if step == "retry" and attempt >= 3:
        return Response(content=vobiz.xml_say("Sari, naavu dashboard alli continue maadtivi. Dhanyavaada.", "kn-IN", None),
                        media_type="application/xml")
    if step == "answer":
        heard = form.get("Speech") or form.get("speech") or form.get("SpeechResult") or form.get("Digits") or ""
        if form.get("Digits") == "1":
            heard = "yes"
        elif form.get("Digits") == "2":
            heard = "no"
        if heard:
            calls.respond(call_id, str(heard))
    elif form.get("HangupCause") or form.get("CallStatus") in {"completed", "failed", "busy", "no-answer"}:
        # Vobiz sends the hangup notification to the answer URL by default.
        cause = form.get("HangupCauseName") or form.get("HangupCause") or form.get("CallStatus")
        audit.record(f"Phone call ended: {cause}", agent="financial_safety", tool="vobiz_call", status="INFO", kind="call")
        if store.get("Calls", call_id) and store.get("Calls", call_id)["status"] != "COMPLETED":
            store.update("Calls", call_id, {"current_step": f"PHONE ENDED ({cause}) — continue in dashboard"})
        return Response(content='<?xml version="1.0" encoding="UTF-8"?><Response></Response>', media_type="application/xml")
    else:
        if store.get("Calls", call_id):
            store.update("Calls", call_id, {"status": "CONNECTED"})
    call_row = store.get("Calls", call_id)
    text, audio = _latest_saathi_line(call_id)
    if not call_row or call_row["status"] == "COMPLETED":
        xml = vobiz.xml_say(text, "kn-IN", audio)
    else:
        hint_id = sarvam.speak(KEYPAD_HINT, "kn-IN")
        hint = f"{settings.public_base_url}/api/audio/{hint_id}" if hint_id and settings.public_base_url else None
        xml = vobiz.xml_prompt(call_id, text, "kn-IN", audio, hint, attempt=attempt if step == "retry" else 0)
    return Response(content=xml, media_type="application/xml")


@router.post("/telegram/webhook")
async def telegram_webhook(request: Request) -> dict:
    telegram.handle_update(await request.json())
    return {"ok": True}


@router.post("/telegram/simulate")
def telegram_simulate(req: SimulateResponse) -> dict:
    """Press an outbox button from the dashboard (Telegram fallback)."""
    return {"result": actions.telegram_callback(req.data, req.who)}
