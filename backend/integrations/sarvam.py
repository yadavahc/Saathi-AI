"""Sarvam AI — Indian-language speech-to-text and text-to-speech.

STT: POST https://api.sarvam.ai/speech-to-text  (multipart, saaras:v4, auto language)
TTS: POST https://api.sarvam.ai/text-to-speech  (JSON, bulbul:v3, base64 WAV)
Fallback: simulated voice (text only; the browser can still use speechSynthesis).
"""
from __future__ import annotations

import base64
import hashlib
import json
import threading

import httpx

from backend.config import settings
from backend.utils.helpers import get_logger

log = get_logger("sarvam")

BASE = "https://api.sarvam.ai"
TTS_LANGS = {"en-IN", "hi-IN", "kn-IN", "ta-IN", "te-IN", "mr-IN", "bn-IN", "gu-IN", "ml-IN", "od-IN", "pa-IN"}


class SarvamClient:
    def __init__(self) -> None:
        self.enabled = bool(settings.sarvam_api_key)
        self.status = "live" if self.enabled else "simulated"
        self.detail = f"STT {settings.sarvam_stt_model} · TTS {settings.sarvam_tts_model}" if self.enabled else "No SARVAM_API_KEY — simulated voice."
        self._audio: dict[str, bytes] = {}
        self._lock = threading.Lock()

    @property
    def _headers(self) -> dict:
        return {"api-subscription-key": settings.sarvam_api_key}

    def transcribe(self, audio: bytes, filename: str = "speech.webm", content_type: str = "audio/webm") -> dict | None:
        """Returns {"transcript", "language_code"} or None on failure."""
        if not self.enabled:
            return None
        try:
            response = httpx.post(
                f"{BASE}/speech-to-text",
                headers=self._headers,
                files={"file": (filename, audio, content_type)},
                data={"model": settings.sarvam_stt_model, "language_code": "unknown"},
                timeout=30,
            )
            response.raise_for_status()
            body = response.json()
            return {"transcript": body.get("transcript", ""), "language_code": body.get("language_code") or "en-IN"}
        except Exception as exc:
            log.warning("Sarvam STT failed: %s", exc)
            return None

    def speak(self, text: str, language_code: str = "en-IN") -> str | None:
        """Synthesize speech; returns an audio id served at /api/audio/{id}."""
        if not self.enabled or not text.strip():
            return None
        lang = language_code if language_code in TTS_LANGS else "en-IN"
        audio_id = hashlib.sha1(f"{lang}:{settings.sarvam_speaker}:{text}".encode()).hexdigest()[:16]
        with self._lock:
            if audio_id in self._audio:
                return audio_id
        payload = {
            "text": text[:2400],
            "target_language_code": lang,
            "model": settings.sarvam_tts_model,
            "speaker": settings.sarvam_speaker,
        }
        try:
            response = httpx.post(f"{BASE}/text-to-speech", headers=self._headers, json=payload, timeout=30)
            if response.status_code == 400 and "language_code" in response.text:
                # newer contract names the field `language_code`
                payload["language_code"] = payload.pop("target_language_code")
                response = httpx.post(f"{BASE}/text-to-speech", headers=self._headers, json=payload, timeout=30)
            response.raise_for_status()
            audios = response.json().get("audios") or []
            if not audios:
                return None
            with self._lock:
                self._audio[audio_id] = base64.b64decode(audios[0])
            return audio_id
        except httpx.HTTPStatusError as exc:
            log.warning("Sarvam TTS failed %s: %s", exc.response.status_code, exc.response.text[:200])
            if exc.response.status_code in (401, 403):
                self.status, self.detail = "fallback", "Sarvam key rejected — simulated voice."
                self.enabled = False
            return None
        except Exception as exc:
            log.warning("Sarvam TTS failed: %s", exc)
            return None

    def audio(self, audio_id: str) -> bytes | None:
        with self._lock:
            return self._audio.get(audio_id)

    def detect_language(self, text: str) -> str | None:
        if not self.enabled:
            return None
        try:
            response = httpx.post(f"{BASE}/text-lid", headers=self._headers, json={"input": text}, timeout=10)
            response.raise_for_status()
            return response.json().get("language_code")
        except Exception:
            return None

    def describe(self) -> str:
        return json.dumps({"status": self.status, "detail": self.detail})


sarvam = SarvamClient()
