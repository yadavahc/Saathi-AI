"""Turns agent results (backend-computed facts) into what SAATHI says, in the user's language."""
from __future__ import annotations

import json

from backend.agents.base import AgentResult, style_for
from backend.integrations.claude_client import claude

SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["text", "speech_text"],
    "properties": {"text": {"type": "string"}, "speech_text": {"type": "string"}},
}

SYSTEM = """You are SAATHI, a warm, sharp financial & business operator for Indian users and small merchants. You speak like a trusted saathi (companion), not a chatbot.
Write the reply the user will read and hear.
Rules:
- Use ONLY the numbers and facts given. Never invent figures, names or outcomes.
- Prioritise: what matters most + why + what to do. No data dumps. 2–4 short sentences, voice-friendly.
- If actions await approval, end by asking the user to approve the most important one (they can approve each individually).
- Never claim an action happened unless it is listed as executed and verified.
- Never ask for OTP, PIN, CVV, passwords or banking credentials.
- Reply in the user's language/style. "kanglish" = Kannada in Latin script mixed with English (e.g. "Nimma sales ivattu 29% increase aagide").
  "hinglish" = Hindi in Latin script mixed with English. For native languages use native script.
- text: the on-screen reply in that style. speech_text: the same reply optimised for Indian TTS — for kanglish/hinglish write it in native script
  (Kannada/Devanagari) keeping English business words; write numbers with commas (₹25,000)."""


def compose(said: str, language: str, results: list[AgentResult], pending: list[dict], use_llm: bool = True) -> dict:
    style = style_for(language)
    fallback = " ".join(r.reply(style) for r in sorted(results, key=lambda r: -r.priority)) if results else ""
    if not results:
        fallback = {"kn": "Namaskara! Naanu SAATHI. Business, payments, fraud, stock — enu sahaya beku?",
                    "hi": "Namaste! Main SAATHI hoon. Business, payments, fraud ya stock — kis cheez mein madad chahiye?",
                    "en": "Hi, I'm SAATHI. I can check fraud, plan urgent money, predict payment failures, run your shop and buy things for you. What do you need?"}[style]
    if not use_llm or not claude.enabled:
        return {"text": fallback, "speech_text": fallback, "engine": "template"}
    payload = {
        "user_said": said,
        "language": language,
        "agent_results": [
            {"agent": r.agent, "headline": r.headline, "findings": r.findings[:5], "decision": r.decision,
             "key_data": {label: value for label, value in r.data[:10]}}
            for r in sorted(results, key=lambda r: -r.priority)
        ],
        "awaiting_approval": [{"action": a["description"], "amount": a["amount"], "impact": a["impact"]} for a in pending],
        "reference_reply": fallback,
    }
    out = claude.structured(system=SYSTEM, prompt=json.dumps(payload, ensure_ascii=False, default=str), schema=SCHEMA, effort="low")
    if not out or not out.get("text"):
        return {"text": fallback, "speech_text": fallback, "engine": "template"}
    return {**out, "engine": "claude"}
