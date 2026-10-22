"""Vobiz — outbound phone calls for voice verification.

Real call: POST https://api.vobiz.ai/api/v1/Account/{auth_id}/Call/ with
X-Auth-ID / X-Auth-Token headers. Vobiz fetches `answer_url`, which SAATHI
serves at /api/vobiz/webhook as VobizXML (Plivo-compatible <Speak>/<Play>/<GetInput>).
Fallback: the simulated live-call panel in the dashboard (always shown).
"""
from __future__ import annotations

from xml.sax.saxutils import escape

import httpx

from backend.config import settings
from backend.utils.helpers import get_logger

log = get_logger("vobiz")


class VobizClient:
    def __init__(self) -> None:
        self.enabled = all([settings.vobiz_auth_id, settings.vobiz_auth_token, settings.vobiz_from_number,
                            settings.vobiz_to_number, settings.public_base_url])
        self.status = "live" if self.enabled else "simulated"
        missing = [name for name, value in [("VOBIZ_AUTH_ID", settings.vobiz_auth_id), ("VOBIZ_AUTH_TOKEN", settings.vobiz_auth_token),
                                            ("VOBIZ_FROM_NUMBER", settings.vobiz_from_number), ("VOBIZ_TO_NUMBER", settings.vobiz_to_number),
                                            ("PUBLIC_BASE_URL", settings.public_base_url)] if not value]
        self.detail = "Outbound calls via Vobiz" if self.enabled else f"Simulated live-call panel — set {', '.join(missing)} for real calls."

    def place_call(self, call_id: str, answer_url: str | None = None) -> dict:
        if not self.enabled:
            return {"placed": False, "simulated": True}
        url = f"https://api.vobiz.ai/api/v1/Account/{settings.vobiz_auth_id}/Call/"
        answer = answer_url or f"{settings.public_base_url}/api/vobiz/webhook?call_id={call_id}&step=start"
        try:
            response = httpx.post(
                url,
                headers={"X-Auth-ID": settings.vobiz_auth_id, "X-Auth-Token": settings.vobiz_auth_token},
                json={"from": settings.vobiz_from_number, "to": settings.vobiz_to_number,
                      "answer_url": answer, "answer_method": "POST"},
                timeout=15,
            )
            response.raise_for_status()
            return {"placed": True, "simulated": False, "provider_response": response.json()}
        except Exception as exc:
            log.warning("Vobiz call failed: %s", exc)
            return {"placed": False, "simulated": True, "error": str(exc)}

    @staticmethod
    def xml_prompt(call_id: str, text: str, language: str, audio_url: str | None, hint_url: str | None = None,
                   attempt: int = 0) -> str:
        """<Gather> accepts speech or a keypress (1 = yes, 2 = no). If the caller stays silent, the <Redirect>
        after it re-asks (up to 3 attempts) instead of letting the call fall off the end of the document."""
        action = f"{settings.public_base_url}/api/vobiz/webhook?call_id={call_id}&step=answer"
        retry = f"{settings.public_base_url}/api/vobiz/webhook?call_id={call_id}&step=retry&attempt={attempt + 1}"
        voice = f"<Play>{escape(audio_url)}</Play>" if audio_url else f'<Speak language="en-IN">{escape(text)}</Speak>'
        hint = f"<Play>{escape(hint_url)}</Play>" if hint_url else ""
        return (
            '<?xml version="1.0" encoding="UTF-8"?><Response>'
            # Vobiz speech recognition has no Kannada model, so listen in en-IN ("yes"/"no") plus the keypad.
            f'<Gather action="{escape(action)}" method="POST" inputType="dtmf speech" numDigits="1" language="en-IN" '
            f'speechEndTimeout="auto" executionTimeout="10" hints="yes,no,howdu,illa,okay">{voice}{hint}</Gather>'
            f'<Redirect method="POST">{escape(retry)}</Redirect>'
            "</Response>"
        )

    @staticmethod
    def xml_say(text: str, language: str, audio_url: str | None) -> str:
        voice = f"<Play>{escape(audio_url)}</Play>" if audio_url else f'<Speak language="en-IN">{escape(text)}</Speak>'
        return f'<?xml version="1.0" encoding="UTF-8"?><Response>{voice}<Hangup/></Response>'


vobiz = VobizClient()
