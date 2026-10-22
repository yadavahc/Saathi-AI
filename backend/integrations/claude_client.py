"""Claude — reasoning and routing layer.

Claude only *understands, reasons and routes*. It never touches records:
every number it sees is computed by backend tools, and every state change goes
through the approval engine. Any failure returns None so callers fall back to
deterministic rules.
"""
from __future__ import annotations

import json
import time

import anthropic

from backend.config import settings
from backend.utils.helpers import get_logger

log = get_logger("claude")

FALLBACK_BETA = "server-side-fallback-2026-07-01"


class ClaudeClient:
    def __init__(self) -> None:
        self.enabled = bool(settings.anthropic_api_key)
        self.status = "live" if self.enabled else "simulated"
        self.detail = f"{settings.claude_model}" if self.enabled else "No ANTHROPIC_API_KEY — rule-based routing."
        self.last_latency_ms: float | None = None
        self._client = (
            anthropic.Anthropic(api_key=settings.anthropic_api_key, timeout=30.0, max_retries=1)
            if self.enabled
            else None
        )

    def _disable(self, reason: str) -> None:
        self.enabled = False
        self.status = "fallback"
        self.detail = reason
        log.warning("Claude disabled: %s", reason)

    def vision(self, *, system: str, prompt: str, image_b64: str, media_type: str, schema: dict, effort: str = "medium") -> dict | None:
        """Read an image (khata page, bill, shelf photo) into schema-constrained JSON."""
        content = [
            {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": image_b64}},
            {"type": "text", "text": prompt},
        ]
        return self.structured(system=system, prompt=content, schema=schema, effort=effort, max_tokens=12000)

    def structured(self, *, system: str, prompt: str | list, schema: dict, effort: str = "low", max_tokens: int = 6000) -> dict | None:
        """One request constrained to a JSON schema. Returns parsed dict or None."""
        if not self.enabled or self._client is None:
            return None
        started = time.perf_counter()
        try:
            response = self._client.beta.messages.create(
                model=settings.claude_model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": prompt}],
                output_config={"effort": effort, "format": {"type": "json_schema", "schema": schema}},
                betas=[FALLBACK_BETA],
                fallbacks="default",
            )
        except anthropic.AuthenticationError:
            self._disable("Claude API key rejected — using rule-based routing.")
            return None
        except anthropic.PermissionDeniedError:
            self._disable("Claude API key lacks permission — using rule-based routing.")
            return None
        except anthropic.RateLimitError:
            log.warning("Claude rate limited; falling back for this request")
            return None
        except anthropic.APIStatusError as exc:
            log.warning("Claude API error %s: %s", exc.status_code, exc.message)
            return None
        except anthropic.APIConnectionError:
            log.warning("Claude unreachable; falling back for this request")
            return None
        self.last_latency_ms = round((time.perf_counter() - started) * 1000)
        if response.stop_reason == "refusal":
            log.warning("Claude declined the request")
            return None
        if response.stop_reason == "max_tokens":
            log.warning("Claude hit max_tokens")
            return None
        text = next((b.text for b in response.content if b.type == "text"), "")
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            log.warning("Claude returned non-JSON output")
            return None


claude = ClaudeClient()
