"""Conversation, dashboard, approvals, calls, audio and demo endpoints."""
from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile

from backend.agents import orchestrator
from backend.agents.base import AGENT_INFO
from backend.demo import runner
from backend.integrations.sarvam import sarvam
from backend.models.schemas import CallResponse, ChatRequest, DecisionRequest, DemoStart, TTSRequest
from backend.services import approvals, audit, calls, radar
from backend.services.store import store

router = APIRouter(prefix="/api")


@router.get("/health")
def health() -> dict:
    return {"ok": True, "integrations": radar.integrations()}


@router.post("/chat")
def chat(req: ChatRequest) -> dict:
    return orchestrator.handle(req.text, persona=req.persona, language_hint=req.language, speak=req.speak)


@router.post("/voice/webhook")
async def voice_webhook(audio: UploadFile | None = File(None), text: str | None = Form(None), persona: str = Form("auto"),
                        call_id: str | None = Form(None)) -> dict:
    """Voice in → Sarvam STT (auto language) → SAATHI loop → Sarvam TTS out."""
    transcript, language = text, None
    if audio is not None:
        data = await audio.read()
        stt = sarvam.transcribe(data, audio.filename or "speech.webm", audio.content_type or "audio/webm")
        if not stt or not stt["transcript"].strip():
            raise HTTPException(422, "Could not transcribe audio (Sarvam unavailable or silent clip) — type your message instead.")
        transcript, language = stt["transcript"], stt["language_code"]
    if not transcript:
        raise HTTPException(400, "Send audio or text")
    if call_id:
        return {"transcript": transcript, "call": calls.respond(call_id, transcript)}
    lang_hint = None
    if language and language.startswith("kn") and not any("ಀ" <= ch <= "೿" for ch in transcript):
        lang_hint = "kanglish"
    result = orchestrator.handle(transcript, persona=persona if persona in {"auto", "consumer", "merchant"} else "auto",
                                 channel="voice", source="voice", speak=True, language_hint=lang_hint)
    return {"transcript": transcript, "stt_language": language, **result}


@router.post("/tts")
def tts(req: TTSRequest) -> dict:
    audio_id = sarvam.speak(req.text, req.language_code)
    return {"audio_url": f"/api/audio/{audio_id}" if audio_id else None, "simulated": audio_id is None}


@router.get("/audio/{audio_id}")
def audio(audio_id: str) -> Response:
    data = sarvam.audio(audio_id)
    if data is None:
        raise HTTPException(404, "audio not found")
    return Response(content=data, media_type="audio/wav")


@router.get("/dashboard")
def dashboard() -> dict:
    return {**radar.dashboard(), "demo": runner.state.snapshot()}


@router.get("/app/{user_id}")
def user_app(user_id: str) -> dict:
    """End-user app: one person's own data only (no agent internals)."""
    data = radar.user_app(user_id)
    if data is None:
        raise HTTPException(404, "user not found")
    return data


@router.get("/activity")
def activity(limit: int = 100, include_reads: bool = True) -> list[dict]:
    return audit.recent(limit, include_reads)


@router.get("/approvals")
def list_approvals(status: str | None = None) -> list[dict]:
    rows = list(reversed(store.all("Approvals")))
    return [approvals.as_card(a) for a in rows if not status or a["status"] == status.upper()]


@router.post("/approvals/{approval_id}/approve")
def approve(approval_id: str, req: DecisionRequest | None = None) -> dict:
    req = req or DecisionRequest()
    try:
        return approvals.as_card(approvals.decide(approval_id, True, by=req.by, channel=req.channel))
    except KeyError:
        raise HTTPException(404, "approval not found")


@router.post("/approvals/{approval_id}/reject")
def reject(approval_id: str, req: DecisionRequest | None = None) -> dict:
    req = req or DecisionRequest()
    try:
        return approvals.as_card(approvals.decide(approval_id, False, by=req.by, channel=req.channel))
    except KeyError:
        raise HTTPException(404, "approval not found")


@router.get("/calls")
def list_calls() -> list[dict]:
    return list(reversed(store.all("Calls")))


@router.post("/calls/{call_id}/respond")
def call_respond(call_id: str, req: CallResponse) -> dict:
    try:
        return calls.respond(call_id, req.text)
    except KeyError:
        raise HTTPException(404, "call not found")


@router.get("/financial-radar")
def financial_radar() -> list[dict]:
    return radar.financial_radar()


@router.get("/agents")
def agents() -> list[dict]:
    return radar.agents_status()


@router.get("/agents/catalog")
def agents_catalog() -> dict:
    return AGENT_INFO


@router.get("/runs")
def runs(limit: int = 20) -> list[dict]:
    return list(reversed(store.all("Agent Runs")))[:limit]


@router.post("/demo/start")
def demo_start(req: DemoStart | None = None) -> dict:
    req = req or DemoStart()
    return runner.start(req.mode, req.scenario)


@router.post("/demo/stop")
def demo_stop() -> dict:
    return runner.stop()


@router.post("/demo/reset")
def demo_reset() -> dict:
    runner.stop()
    runner.reset_world()
    return {"ok": True}


@router.get("/demo")
def demo_state() -> dict:
    return runner.state.snapshot()
