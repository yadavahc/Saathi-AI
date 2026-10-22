"""The SAATHI loop:

REQUEST/EVENT → UNDERSTAND → IDENTIFY INTENT → RETRIEVE DATA → ANALYZE → REASON →
RECOMMEND → ASK APPROVAL → (EXECUTE → VERIFY → UPDATE → INFORM, via approvals) → AUDIT
"""
from __future__ import annotations

import re
from typing import Any

from backend.agents import commerce, financial_safety, merchant_growth, merchant_ops, money_sos, payment_reliability
from backend.agents.base import AGENT_INFO, CONSUMER_ID, MERCHANT_USER_ID, AgentResult, style_for, tts_code
from backend.agents.composer import compose
from backend.agents.router import MERCHANT_INTENTS, agent_for, route, rule_route
from backend.integrations.sarvam import sarvam
from backend.services import approvals, audit, flow
from backend.tools.registry import ToolError

HANDLERS = {
    "financial_safety": financial_safety.handle,
    "money_sos": money_sos.handle,
    "merchant_ops": merchant_ops.handle,
    "merchant_growth": merchant_growth.handle,
    "payment_reliability": payment_reliability.handle,
}

SENSITIVE = re.compile(r"\b(otp|o\.t\.p|pin(?!\s*-?code)|cvv|password|passcode|net ?banking (id|password)|card number)\b", re.I)

# Tiny per-user conversation memory so follow-ups ("yes, it's for hospital") keep context.
_memory: dict[str, dict] = {}


def reset_memory() -> None:
    _memory.clear()


def _remember(user_id: str, role: str, text: str, **facts: Any) -> None:
    mem = _memory.setdefault(user_id, {"history": []})
    mem["history"] = (mem["history"] + [{"role": role, "text": text}])[-8:]
    mem.update({k: v for k, v in facts.items() if v is not None})


def safety_reply(language: str) -> str:
    style = style_for(language)
    return {
        "kn": "Dayavittu nimma OTP, PIN, CVV athava password yaarigu helabedi — nanagu kooda. SAATHI yavaagloo idannu keLalla.",
        "hi": "Kripya apna OTP, PIN, CVV ya password kisi ko mat batayiye — mujhe bhi nahi. SAATHI kabhi yeh nahi maangta.",
        "en": "Please never share your OTP, PIN, CVV or passwords with anyone — including me. SAATHI will never ask for them.",
    }[style]


def _run_agent(intent: str, entities: dict, user_id: str, text: str) -> AgentResult | None:
    agent = agent_for(intent)
    try:
        if agent == "commerce":
            return commerce.handle(intent, entities, user_id, text=text)
        fn = HANDLERS.get(agent)
        return fn(intent, entities, user_id) if fn else None
    except ToolError as exc:
        audit.record(f"{agent} could not complete: {exc}", agent=agent, intent=intent, status="FAILED")
        return AgentResult(agent=agent, intent=intent, headline=f"Couldn't complete: {exc}", replies={"en": f"Sorry — {exc}."})


def handle(text: str, *, persona: str = "auto", source: str = "chat", channel: str = "text", language_hint: str | None = None,
           forced_intents: list[dict] | None = None, use_llm: bool = True, llm_reply: bool | None = None,
           speak: bool = False, user_id: str | None = None) -> dict:
    default_user = MERCHANT_USER_ID if persona == "merchant" else CONSUMER_ID
    memory_user = user_id or default_user
    run = flow.start(text, source=source, user_id=memory_user, channel=channel)
    run_id = run["run_id"]
    with flow.bind(run_id):
        # 1. UNDERSTAND + IDENTIFY INTENT
        if forced_intents:
            decision = {"language": language_hint or "en", "intents": forced_intents, "risk_level": "MEDIUM",
                        "requires_confirmation": True, "reasoning": "System event", "engine": "event"}
        else:
            context = _memory.get(memory_user)
            decision = route(text, persona, context) if use_llm else rule_route(text, context)
        language = language_hint if language_hint and language_hint != "auto" else decision["language"]
        intents = decision["intents"]
        flow.stage(run_id, "UNDERSTOOD", language=language, understood={
            "intents": [i["intent"] for i in intents], "agents": [agent_for(i["intent"]) for i in intents],
            "entities": {k: v for i in intents for k, v in i["entities"].items() if v not in (None, [], "")},
            "risk_level": decision["risk_level"], "engine": decision.get("engine"), "reasoning": decision.get("reasoning", "")})
        audit.record(f"Understood: {', '.join(i['intent'] for i in intents)} ({decision.get('engine')})", agent="router",
                     intent=",".join(i["intent"] for i in intents), input=text, status="INFO", kind="routing", run_id=run_id)

        # Safety: never collect secrets.
        if SENSITIVE.search(text):
            reply = safety_reply(language)
            flow.update(run_id, stage="VERIFIED", decision="Safety rule: never collect OTP/PIN/CVV", reply=reply, status="COMPLETED",
                        verified="No credentials collected")
            audit.record("Blocked a credential-sharing attempt", agent="safety", status="WARNING", run_id=run_id)
            return _response(run_id, reply, reply, language, [], [], speak, "safety")

        # 2. RETRIEVE + ANALYZE + REASON (agents call tools)
        results: list[AgentResult] = []
        for item in intents:
            if item["intent"] == "general":
                continue
            uid = MERCHANT_USER_ID if item["intent"] in MERCHANT_INTENTS else (user_id or CONSUMER_ID)
            res = _run_agent(item["intent"], item["entities"], uid, text)
            if res:
                results.append(res)
        for res in results:
            for label, value in res.data:
                flow.add_data(run_id, label, value)
        flow.stage(run_id, "DATA", agents=[r.agent for r in results])
        decision_text = " | ".join(f"{AGENT_INFO[r.agent]['name']}: {r.decision}" for r in results if r.decision) or "Answer directly"
        flow.stage(run_id, "DECIDED", decision=decision_text)

        # 3. RECOMMEND + ASK APPROVAL
        created = []
        for res in sorted(results, key=lambda r: -r.priority):
            for prop in res.proposals:
                created.append(approvals.propose(action=prop.action, description=prop.description, agent=res.agent,
                                                 params=prop.params, amount=prop.amount, impact=prop.impact, target=prop.target,
                                                 reason=prop.reason, user_id=res.user_id, run_id=run_id, simulated=prop.simulated))
        if created:
            flow.stage(run_id, "APPROVAL", status="AWAITING_APPROVAL")
        else:
            flow.update(run_id, stage="VERIFIED", status="COMPLETED", action="Information delivered — no state change",
                        verified="Read-only: figures computed by backend tools")

        # 4. INFORM
        said = compose(text, language, results, created, use_llm=use_llm if llm_reply is None else llm_reply)
        flow.update(run_id, reply=said["text"])
        for item in intents:
            ent = item["entities"]
            _remember(memory_user, "user", text, last_intent=item["intent"], amount=ent.get("amount"), purpose=ent.get("purpose"))
        _remember(memory_user, "saathi", said["text"])
        return _response(run_id, said["text"], said.get("speech_text") or said["text"], language, results, created, speak, said["engine"])


def _response(run_id: str, text: str, speech: str, language: str, results: list[AgentResult], created: list[dict],
              speak: bool, engine: str) -> dict:
    audio_id = sarvam.speak(speech, tts_code(language)) if speak else None
    return {
        "run_id": run_id,
        "reply": text,
        "speech_text": speech,
        "language": language,
        "tts_language": tts_code(language),
        "audio_url": f"/api/audio/{audio_id}" if audio_id else None,
        "engine": engine,
        "agents": [{"agent": r.agent, "name": AGENT_INFO[r.agent]["name"], "headline": r.headline, "findings": r.findings,
                    "data": [{"label": k, "value": v} for k, v in r.data],
                    "suggested_actions": r.facts.get("suggested_actions", [])} for r in results],
        "approvals": [approvals.as_card(a) for a in created],
        "run": flow.get(run_id),
    }
