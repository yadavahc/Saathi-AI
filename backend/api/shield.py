"""Scam Shield endpoints: start / listen / end, plus the live phone path.

Phone path: SAATHI calls the user (Vobiz). They merge the suspicious call into it.
Vobiz runs <Stream> and forks the call audio to our websocket as L16/16 kHz frames;
every ~5 s of speech goes to Sarvam STT and into the same detector. Warnings are
spoken back into the call with `playAudio`.
"""
from __future__ import annotations

import array
import asyncio
import base64
import io
import json
import threading
import wave
from xml.sax.saxutils import escape

from fastapi import APIRouter, File, HTTPException, Request, Response, UploadFile, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from backend.config import settings
from backend.integrations.sarvam import sarvam
from backend.integrations.vobiz import vobiz
from backend.services import audit, scam_shield
from backend.services.store import store
from backend.utils.helpers import get_logger

log = get_logger("shield-api")
router = APIRouter(prefix="/api/shield")

WINDOW_SECONDS = 5
SILENCE_RMS = 120  # skip near-silent windows (saves STT calls)
GREETING = "ಸಾಥಿ ಶೀಲ್ಡ್ ಆನ್ ಆಗಿದೆ. ಸಂದೇಹದ ಕಾಲ್ ಅನ್ನು ಈ ಕಾಲ್ ಜೊತೆ ಮರ್ಜ್ ಮಾಡಿ. ನಾನು ಕೇಳಿಸಿಕೊಳ್ತೀನಿ."


class StartRequest(BaseModel):
    user_id: str = "U001"
    source: str = Field("simulation", pattern="^(simulation|mic|phone)$")
    scenario: str = "digital_arrest"
    caller: str = "Unknown number"


class TextRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1000)
    speaker: str = "CALL"


@router.get("")
def list_sessions(limit: int = 5) -> list[dict]:
    return scam_shield.recent(limit)


@router.get("/scenarios")
def scenarios() -> dict:
    return {k: {"title": v["title"], "caller": v["caller"]} for k, v in scam_shield.SCENARIOS.items()}


@router.post("/start")
def start(req: StartRequest) -> dict:
    if req.source == "simulation":
        return scam_shield.simulate(req.scenario, req.user_id)
    if req.source == "phone":
        if not vobiz.enabled:
            raise HTTPException(409, "Phone protection needs Vobiz + PUBLIC_BASE_URL configured")
        session = scam_shield.start(req.user_id, "phone", "Merged phone call")
        answer = f"{settings.public_base_url}/api/shield/vobiz/answer?session_id={session['session_id']}"
        placed = vobiz.place_call(session["session_id"], answer_url=answer)
        store.update("Shield Sessions", session["session_id"], {"stream": "RINGING" if placed.get("placed") else "CALL FAILED"})
        return scam_shield.get(session["session_id"])
    return scam_shield.start(req.user_id, "mic", req.caller)


@router.get("/{session_id}")
def get_session(session_id: str) -> dict:
    session = scam_shield.get(session_id)
    if not session:
        raise HTTPException(404, "session not found")
    return session


@router.post("/{session_id}/text")
def add_text(session_id: str, req: TextRequest) -> dict:
    return scam_shield.ingest(session_id, req.text, req.speaker) or {}


@router.post("/{session_id}/audio")
async def add_audio(session_id: str, audio: UploadFile = File(...)) -> dict:
    """Speakerphone mode: one ~6 s browser recording → Sarvam STT → detector."""
    data = await audio.read()
    stt = sarvam.transcribe(data, audio.filename or "chunk.webm", audio.content_type or "audio/webm")
    text = (stt or {}).get("transcript", "")
    if text:
        scam_shield.ingest(session_id, text, "CALL")
    return {"transcript": text, "session": scam_shield.get(session_id)}


@router.post("/{session_id}/end")
def end(session_id: str) -> dict:
    return scam_shield.end(session_id) or {}


# ── live phone path (Vobiz) ──────────────────────────────────────────────────
@router.post("/vobiz/answer")
async def vobiz_answer(request: Request, session_id: str) -> Response:
    form = dict(await request.form()) if "form" in request.headers.get("content-type", "") else {}
    if form.get("HangupCause") or form.get("CallStatus") in {"completed", "failed", "busy", "no-answer"}:
        audit.record(f"Shield phone call ended: {form.get('HangupCauseName') or form.get('CallStatus')}", agent="financial_safety",
                     tool="scam_shield", status="INFO", kind="shield")
        scam_shield.end(session_id)
        return Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', media_type="application/xml")
    store.update("Shield Sessions", session_id, {"stream": "ANSWERED"})
    greet_id = sarvam.speak(GREETING, "kn-IN")
    greet = f"<Play>{escape(settings.public_base_url)}/api/audio/{greet_id}</Play>" if greet_id else ""
    wss = settings.public_base_url.replace("https://", "wss://").replace("http://", "ws://") + f"/api/shield/stream/{session_id}"
    xml = ('<?xml version="1.0" encoding="UTF-8"?><Response>' + greet +
           f'<Stream bidirectional="true" keepCallAlive="true" contentType="audio/x-l16;rate=16000">{escape(wss)}</Stream>'
           "</Response>")
    return Response(xml, media_type="application/xml")


def _to_wav(pcm: bytes, rate: int) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)
    return buf.getvalue()


def _samples(pcm: bytes, swap: bool) -> array.array:
    a = array.array("h")
    a.frombytes(pcm[: len(pcm) - len(pcm) % 2])
    if swap:
        a.byteswap()
    return a


def _roughness(a: array.array) -> float:
    step = max(1, len(a) // 4000)
    pts = a[::step]
    return sum(abs(pts[i] - pts[i - 1]) for i in range(1, len(pts))) / max(1, len(pts) - 1)


def _transcribe_window(session_id: str, pcm: bytes, rate: int, state: dict) -> None:
    if state["swap"] is None:  # L16 byte order isn't documented — pick the smoother interpretation
        state["swap"] = _roughness(_samples(pcm, True)) < _roughness(_samples(pcm, False))
        log.info("Shield stream byte order: %s", "big-endian" if state["swap"] else "little-endian")
    samples = _samples(pcm, state["swap"])
    rms = (sum(s * s for s in samples[::8]) / max(1, len(samples[::8]))) ** 0.5
    if rms < SILENCE_RMS:
        return
    stt = sarvam.transcribe(_to_wav(samples.tobytes(), rate), "call.wav", "audio/wav")
    text = (stt or {}).get("transcript", "")
    if text:
        scam_shield.ingest(session_id, text, "CALL")


@router.websocket("/stream/{session_id}")
async def stream(ws: WebSocket, session_id: str) -> None:
    await ws.accept()
    loop = asyncio.get_running_loop()
    state = {"stream_id": None, "rate": 16000, "buf": bytearray(), "swap": None}
    store.update("Shield Sessions", session_id, {"stream": "STREAMING"}) if scam_shield.get(session_id) else None

    def send_pcm(pcm: bytes) -> None:
        """Called from worker threads: speak a warning into the live call."""
        async def _send() -> None:
            data = pcm
            if state["swap"]:
                a = _samples(pcm, True)
                data = a.tobytes()
            for i in range(0, len(data), 3200):  # 100 ms chunks at 16 kHz
                await ws.send_text(json.dumps({"event": "playAudio", "streamId": state["stream_id"],
                                               "media": {"contentType": "audio/x-l16", "sampleRate": 16000,
                                                         "payload": base64.b64encode(data[i:i + 3200]).decode()}}))
            await ws.send_text(json.dumps({"event": "checkpoint", "streamId": state["stream_id"], "name": "shield-warning"}))
        asyncio.run_coroutine_threadsafe(_send(), loop)

    scam_shield._streams[session_id] = {"send": send_pcm}
    try:
        while True:
            message = json.loads(await ws.receive_text())
            event = message.get("event")
            if event == "start":
                start_info = message.get("start", {})
                state["stream_id"] = start_info.get("streamId")
                state["rate"] = int((start_info.get("mediaFormat") or {}).get("sampleRate") or 16000)
                audit.record("Shield is listening to the live phone call (Vobiz stream)", agent="financial_safety",
                             tool="scam_shield", status="INFO", kind="shield")
            elif event == "media":
                state["buf"].extend(base64.b64decode(message["media"]["payload"]))
                if len(state["buf"]) >= state["rate"] * 2 * WINDOW_SECONDS:
                    chunk = bytes(state["buf"])
                    state["buf"].clear()
                    store.mutate("Shield Sessions", session_id, lambda s: s.update({"chunks": s.get("chunks", 0) + 1}))
                    threading.Thread(target=_transcribe_window, args=(session_id, chunk, state["rate"], state), daemon=True).start()
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        log.warning("Shield stream error: %s", exc)
    finally:
        scam_shield._streams.pop(session_id, None)
        if len(state["buf"]) > state["rate"] * 2:
            threading.Thread(target=_transcribe_window, args=(session_id, bytes(state["buf"]), state["rate"], state), daemon=True).start()
        if scam_shield.get(session_id):
            store.update("Shield Sessions", session_id, {"stream": "CLOSED"})
