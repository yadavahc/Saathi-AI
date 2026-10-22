"""Scam Shield — SAATHI listens to a suspicious call and warns the user live.

Audio arrives from three sources and lands in the same `ingest()`:
  * phone   — SAATHI calls the user, they merge the suspicious call; Vobiz streams
              the call audio over a websocket (L16/16 kHz) → Sarvam STT in 5 s windows
  * mic     — the call is on speaker; the browser records 6 s chunks → Sarvam STT
  * simulation — a scripted scam call voiced by Sarvam TTS (demo-safe)

Detection = instant multilingual red-flag rules (explainable, never miss the
obvious) + Claude reading the whole conversation (scam type, explanation).
Escalation SAFE → SUSPICIOUS → SCAM triggers a Kannada voice warning; reporting,
alerting family and blocking still go through the approval engine.
"""
from __future__ import annotations

import re
import threading
import time

from backend.integrations.claude_client import claude
from backend.integrations.sarvam import sarvam
from backend.integrations.telegram import telegram
from backend.services import approvals, audit, flow
from backend.services.store import store
from backend.utils.helpers import get_logger, now_iso

log = get_logger("shield")

# (id, what the user sees, weight, multilingual pattern)
SIGNALS = [
    ("authority", "Pretends to be police / CBI / RBI / customs officer", 22,
     r"police|cbi|\bed\b|enforcement directorate|customs|rbi|trai|cyber ?crime|narcotics|inspector|officer|court|judge|"
     r"पुलिस|अधिकारी|सीबीआई|इंस्पेक्टर|ऑफिसर|कस्टम्स|आरबीआई|साइबर क्राइम|ಪೊಲೀಸ್|ಅಧಿಕಾರಿ|ಸಿಬಿಐ|ಇನ್ಸ್|ಆಫೀಸರ್|ಹೆಡ್ ಆಫೀಸ್|bank head office|head office"),
    ("arrest", "Threatens arrest, FIR or 'digital arrest'", 25,
     r"arrest|warrant|\bfir\b|case (is )?registered|jail|legal action|गिरफ्तार|अरेस्ट|वारंट|एफआईआर|जेल|ಅರೆಸ್ಟ್|ಬಂಧನ|ವಾರಂಟ್|ಎಫ್‌ಐಆರ್|ಜೈಲು"),
    ("parcel", "Fake parcel / drugs / passport story", 15,
     r"parcel|courier|fedex|dhl|drugs|mdma|narcotic|fake passport|illegal items|पार्सल|ड्रग|फेडेक्स|ಪಾರ್ಸೆಲ್|ಡ್ರಗ್ಸ್"),
    ("kyc", "Fake KYC update or account / SIM block threat", 15,
     r"\bkyc\b|account (will be |gets )?(block|freez|suspend|clos)|block aagutte|sim (will be )?block|update (your )?(pan|aadhaar)|केवाईसी|अकाउंट ब्लॉक|ಕೆವೈಸಿ|ಬ್ಲಾಕ್ ಆಗುತ್ತೆ|ಅಕೌಂಟ್ ಬ್ಲಾಕ್"),
    ("credentials", "Asks for OTP, PIN, CVV or a remote-access app", 30,
     r"\botp\b|\bpin\b|\bcvv\b|password|anydesk|teamviewer|quick ?support|screen ?shar|install (this |the )?app|click (the |this )?link|"
     r"ओटीपी|पिन|एनीडेस्क|पासवर्ड|ಓಟಿಪಿ|ಪಿನ್|ಎನಿಡೆಸ್ಕ್|ಪಾಸ್‌ವರ್ಡ್"),
    ("money", "Demands money to a 'safe account' / UPI ID", 30,
     r"safe account|transfer (all |your |the )?(money|amount|funds|paisa)|paisa transfer|upi id|send (the )?money|verification (amount|fee)|"
     r"pay (a )?(fine|penalty)|deposit (the )?amount|bhejiye|ट्रांसफर|पैसा भेज|सेफ अकाउंट|यूपीआई|ಹಣ ಕಳಿಸ|ಹಣ ಹಾಕಿ|ಸೇಫ್ ಅಕೌಂಟ್|ಟ್ರಾನ್ಸ್|ಯುಪಿಐ"),
    ("secrecy", "Tells you to stay on the call and tell no one", 18,
     r"(don'?t|do not) (disconnect|cut|hang up|tell)|disconnect mat|kisi ko mat|confidential|secret|stay on (the )?(video )?call|"
     r"यह बात किसी|किसी को मत|डिस्कनेक्ट मत|कॉन्फिडेंशियल|ಯಾರಿಗೂ ಹೇಳ|ಡಿಸ್ಕನೆಕ್ಟ್|cut maadbedi"),
    ("urgency", "Creates extreme urgency", 10,
     r"immediately|right now|within (\d+ )?(minutes?|hours?)|turant|abhi turant|jaldi|bega|\d+ nimisha|last chance|तुरंत|जल्दी|ತಕ್ಷಣ|ಬೇಗ|ಈಗಲೇ"),
    ("bait", "Prize, refund or easy-money bait", 15,
     r"lottery|prize|you (have )?won|cashback|refund|kbc|lucky draw|work from home job|guaranteed returns|double (your )?money"),
]

WARNINGS = {
    "SUSPICIOUS": {
        "text": "⚠️ Jaagrathe! Ee call alli scam lakshanagalu kaanisuttive. Yaavude OTP, PIN athava hana kodabedi.",
        "english": "Careful — this call shows scam signs. Don't share any OTP, PIN or money.",
        "speech": "ಜಾಗ್ರತೆ! ಈ ಕಾಲ್‌ನಲ್ಲಿ ಸ್ಕ್ಯಾಮ್ ಲಕ್ಷಣಗಳು ಕಾಣಿಸುತ್ತಿವೆ. ಯಾವುದೇ OTP, PIN ಅಥವಾ ಹಣ ಕೊಡಬೇಡಿ.",
    },
    "SCAM": {
        "text": "🚨 Idu scam call! Phone cut maadi. Police athava bank yavaagloo phone nalli hana, OTP keLalla. 'Digital arrest' antha yaavudu illa.",
        "english": "This is a scam call! Hang up now. Police and banks never ask for money or OTP on a call. There is no such thing as a 'digital arrest'.",
        "speech": "ಇದು ಸ್ಕ್ಯಾಮ್ ಕಾಲ್! ಫೋನ್ ಕಟ್ ಮಾಡಿ. ಪೊಲೀಸ್ ಅಥವಾ ಬ್ಯಾಂಕ್ ಯಾವತ್ತೂ ಫೋನ್‌ನಲ್ಲಿ ಹಣ, OTP ಕೇಳಲ್ಲ. ಡಿಜಿಟಲ್ ಅರೆಸ್ಟ್ ಅನ್ನೋದು ಇಲ್ಲವೇ ಇಲ್ಲ.",
    },
}

SCENARIOS = {
    "digital_arrest": {
        "title": "'Digital arrest' scam (Hinglish)", "caller": "+91 70XXX XX412", "language": "hi-IN",
        "lines": [
            ("CALLER", "Hello, main Mumbai Cyber Crime branch se Inspector Vikram Sharma bol raha hoon.", None),
            ("USER", "Haan ji, boliye?", None),
            ("CALLER", "Aapke Aadhaar card se ek FedEx parcel book hua hai, usme drugs aur fake passport mile hain.", None),
            ("USER", "Kya? Maine koi parcel nahi bheja.", None),
            ("CALLER", "Aapke naam par FIR register ho chuki hai. Aapko abhi digital arrest kiya ja raha hai.", None),
            ("CALLER", "Yeh call disconnect mat kijiye aur kisi ko mat bataiye, yeh case confidential hai.", None),
            ("CALLER", "Verification ke liye apna saara paisa RBI ke safe account mein transfer kijiye.", None),
            ("CALLER", "Abhi turant pachaas hazaar rupaye is UPI ID par bhejiye aur jo OTP aaye woh mujhe bataiye.", None),
        ],
    },
    "kyc_fraud": {
        "title": "Fake bank KYC scam (Kannada)", "caller": "+91 63XXX XX087", "language": "kn-IN",
        "lines": [
            ("CALLER", "Namaskara sir, naanu SBI bank head office inda maatadtidini.", "ನಮಸ್ಕಾರ ಸರ್, ನಾನು SBI ಬ್ಯಾಂಕ್ ಹೆಡ್ ಆಫೀಸ್‌ನಿಂದ ಮಾತಾಡ್ತಿದೀನಿ."),
            ("CALLER", "Nimma KYC expire aagide, ivattu update maadilla andre account block aagutte.", "ನಿಮ್ಮ KYC ಎಕ್ಸ್‌ಪೈರ್ ಆಗಿದೆ, ಇವತ್ತು ಅಪ್‌ಡೇಟ್ ಮಾಡಿಲ್ಲ ಅಂದ್ರೆ ಅಕೌಂಟ್ ಬ್ಲಾಕ್ ಆಗುತ್ತೆ."),
            ("USER", "Howda? Enu maadbeku?", "ಹೌದಾ? ಏನು ಮಾಡಬೇಕು?"),
            ("CALLER", "Naanu ondu link kalistini, AnyDesk app install maadi.", "ನಾನು ಒಂದು ಲಿಂಕ್ ಕಳಿಸ್ತೀನಿ, AnyDesk ಆಪ್ ಇನ್‌ಸ್ಟಾಲ್ ಮಾಡಿ."),
            ("CALLER", "Nimma phone ge bandiro OTP heli, bega, hattu nimisha maatra time ide.", "ನಿಮ್ಮ ಫೋನ್‌ಗೆ ಬಂದಿರೋ OTP ಹೇಳಿ, ಬೇಗ, ಹತ್ತು ನಿಮಿಷ ಮಾತ್ರ ಟೈಮ್ ಇದೆ."),
        ],
    },
    "safe_call": {
        "title": "Genuine pharmacy call (English)", "caller": "+91 80XXX XX310", "language": "en-IN",
        "lines": [
            ("CALLER", "Hi Rahul, this is Priya from Apollo Pharmacy, Indiranagar.", None),
            ("CALLER", "Your medicine order is ready. You can pick it up after 5 PM today.", None),
            ("USER", "Okay, thank you.", None),
            ("CALLER", "You can pay at the counter when you come. Have a nice day!", None),
        ],
    },
}
VOICES = {"CALLER": "amit", "USER": "rahul"}

AI_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["scam_probability", "scam_type", "explanation", "red_flags", "advice"],
    "properties": {
        "scam_probability": {"type": "number"},
        "scam_type": {"type": "string", "enum": ["digital_arrest", "kyc_fraud", "parcel_drugs", "otp_fraud", "investment_fraud",
                                                  "lottery_prize", "relative_in_trouble", "job_fraud", "loan_fraud", "legitimate", "unclear"]},
        "explanation": {"type": "string"},
        "red_flags": {"type": "array", "items": {"type": "string"}},
        "advice": {"type": "string"},
    },
}
AI_SYSTEM = """You protect Indian phone users from scam calls. You read a live, possibly partial and noisy transcript
(Hindi, Kannada, English or code-mixed; speaker labels may be missing) and judge whether the call is a scam.
Know the common Indian patterns: fake police/CBI 'digital arrest', drugs-in-parcel, fake bank/KYC update, OTP or
remote-access (AnyDesk) requests, 'safe account' transfers, lottery/refund bait, relative-in-trouble, fake jobs/loans.
Genuine businesses can mention payment or orders — only flag what is actually suspicious.
scam_probability: 0.0-1.0. explanation: one or two plain sentences for the user. advice: one short instruction."""

_lock = threading.Lock()
_analyzing: set[str] = set()
_dirty: set[str] = set()
_streams: dict[str, dict] = {}  # session_id -> {"send": callable(bytes pcm)} for live phone playback


def _verdict(risk: int) -> str:
    return "SCAM" if risk >= 70 else "SUSPICIOUS" if risk >= 35 else "SAFE"


def start(user_id: str = "U001", source: str = "simulation", caller: str = "Unknown number", scenario: str | None = None) -> dict:
    run = flow.start(f"🛡️ Scam Shield · {caller} · {source}", source="shield", user_id=user_id, channel="voice", language="kanglish")
    session = {
        "session_id": store.next_id("SHD"), "user_id": user_id, "source": source, "scenario": scenario, "caller": caller,
        "status": "LISTENING", "started_at": now_iso(), "ended_at": "", "transcript": [], "signals": [], "rule_score": 0,
        "ai": None, "risk": 0, "verdict": "SAFE", "warnings": [], "approval_ids": [], "run_id": run["run_id"], "call_id": "",
        "stream": "", "chunks": 0,
    }
    store.insert("Shield Sessions", session)
    flow.stage(run["run_id"], "UNDERSTOOD", understood={"intents": ["scam_call_check"], "agents": ["financial_safety"],
                                                        "entities": {"caller": caller, "source": source}, "risk_level": "PENDING",
                                                        "engine": "rules + claude", "reasoning": "Live call monitoring"})
    audit.record(f"Scam Shield listening ({source}) — caller {caller}", agent="financial_safety", tool="scam_shield",
                 status="INFO", kind="shield", run_id=run["run_id"], user=user_id)
    return session


def get(session_id: str) -> dict | None:
    return store.get("Shield Sessions", session_id)


def ingest(session_id: str, text: str, speaker: str = "CALL", audio_url: str | None = None) -> dict | None:
    """Add one utterance; re-score instantly with rules; queue a Claude re-read."""
    text = (text or "").strip()
    session = get(session_id)
    if not text or not session or session["status"] != "LISTENING":
        return session
    entry = {"speaker": speaker, "text": text, "ts": now_iso(), "audio_url": audio_url}
    store.mutate("Shield Sessions", session_id, lambda s: s["transcript"].append(entry))
    if speaker != "USER":
        _apply_rules(session_id, text)
    _queue_ai(session_id)
    return get(session_id)


def _apply_rules(session_id: str, text: str) -> None:
    lowered = text.lower()
    session = get(session_id)
    found = {s["id"] for s in session["signals"]}
    new = []
    for sid, label, weight, pattern in SIGNALS:
        if sid in found:
            continue
        match = re.search(pattern, lowered) or re.search(pattern, text)
        if match:
            new.append({"id": sid, "label": label, "weight": weight, "evidence": text, "match": match.group(0), "ts": now_iso()})
    if not new:
        return

    def add(s: dict) -> None:
        s["signals"].extend(new)
        s["rule_score"] = min(100, sum(x["weight"] for x in s["signals"]))

    store.mutate("Shield Sessions", session_id, add)
    for sig in new:
        flow.add_data(session["run_id"], "Red flag", sig["label"])
        audit.record(f"Scam signal: {sig['label']} — “{sig['match']}”", agent="financial_safety", tool="scam_shield",
                     status="WARNING", kind="shield", run_id=session["run_id"])
    _escalate(session_id)


def _queue_ai(session_id: str) -> None:
    with _lock:
        if session_id in _analyzing:
            _dirty.add(session_id)
            return
        _analyzing.add(session_id)
    threading.Thread(target=_ai_loop, args=(session_id,), daemon=True).start()


def _ai_loop(session_id: str) -> None:
    try:
        while True:
            session = get(session_id)
            if not session:
                return
            lines = "\n".join(f"{t['speaker']}: {t['text']}" for t in session["transcript"][-30:])
            result = claude.structured(system=AI_SYSTEM, prompt=f"Caller number: {session['caller']}\nTranscript so far:\n{lines}",
                                       schema=AI_SCHEMA, effort="low", max_tokens=3000)
            if result:
                result["engine"] = "claude"
                store.update("Shield Sessions", session_id, {"ai": result})
                _escalate(session_id)
            with _lock:
                if session_id in _dirty:
                    _dirty.discard(session_id)
                    continue
                _analyzing.discard(session_id)
                return
    except Exception as exc:
        log.warning("Shield AI analysis failed: %s", exc)
        with _lock:
            _analyzing.discard(session_id)


def _escalate(session_id: str) -> None:
    with _lock:
        session = get(session_id)
        if not session:
            return
        ai_score = round((session["ai"] or {}).get("scam_probability", 0) * 100)
        risk = max(session["rule_score"], ai_score)
        verdict = _verdict(risk)
        levels = ["SAFE", "SUSPICIOUS", "SCAM"]
        escalated = levels.index(verdict) > levels.index(session["verdict"])
        store.update("Shield Sessions", session_id, {"risk": risk, "verdict": verdict if escalated else session["verdict"]})
    if escalated:
        _warn(session_id, verdict)


def _warn(session_id: str, level: str) -> None:
    session = get(session_id)
    w = WARNINGS[level]
    warning = {"level": level, "text": w["text"], "english": w["english"], "speech": w["speech"], "audio_url": None, "ts": now_iso()}
    store.mutate("Shield Sessions", session_id, lambda s: s["warnings"].append(warning))
    index = len(get(session_id)["warnings"]) - 1
    run_id = session["run_id"]
    audit.record(f"Scam Shield → {level}: warned the user in Kannada", agent="financial_safety", tool="scam_shield",
                 status="WARNING", kind="shield", run_id=run_id)
    flow.stage(run_id, "DECIDED", decision=f"Call looks like a {'scam' if level == 'SCAM' else 'possible scam'} → warn the user immediately"
               + (" and offer report / family alert / block" if level == "SCAM" else ""))

    def voice() -> None:
        audio_id = sarvam.speak(w["speech"], "kn-IN")
        if audio_id:
            store.mutate("Shield Sessions", session_id, lambda s: s["warnings"][index].update({"audio_url": f"/api/audio/{audio_id}"}))
        stream = _streams.get(session_id)
        if stream:  # also speak the warning into the live phone call
            pcm = sarvam.pcm16(w["speech"], "kn-IN", 16000)
            if pcm:
                stream["send"](pcm)

    threading.Thread(target=voice, daemon=True).start()
    if level == "SCAM":
        telegram.send(role="user", title="Scam call warning", related_id=session_id,
                      text=f"🚨 <b>SAATHI Scam Shield</b>\nThe call from {session['caller']} looks like a scam.\n{w['english']}")
        _propose_actions(session_id)


def _propose_actions(session_id: str) -> None:
    session = get(session_id)
    with flow.bind(session["run_id"]):
        signals = ", ".join(s["label"] for s in session["signals"][:3]) or "AI analysis"
        props = [
            ("REPORT_SCAM_CALL", f"Report {session['caller']} to Sanchar Saathi (Chakshu) & cybercrime 1930",
             "Helps block the number for everyone; creates your complaint record"),
            ("ALERT_FAMILY", "Alert your family on Telegram that you received a scam call", "Someone you trust knows right away"),
            ("BLOCK_CALLER", f"Block {session['caller']} on this account", "This number can't reach you through SAATHI again"),
        ]
        ids = []
        for action, desc, impact in props:
            a = approvals.propose(action=action, description=desc, agent="financial_safety", impact=impact, target=session["caller"],
                                  reason=f"Scam Shield risk {get(session_id)['risk']}/100 — {signals}",
                                  params={"session_id": session_id}, user_id=session["user_id"], run_id=session["run_id"])
            ids.append(a["approval_id"])
    store.update("Shield Sessions", session_id, {"approval_ids": ids})
    flow.stage(session["run_id"], "APPROVAL", status="AWAITING_APPROVAL")


def end(session_id: str) -> dict | None:
    session = get(session_id)
    if not session or session["status"] == "ENDED":
        return session
    store.update("Shield Sessions", session_id, {"status": "ENDED", "ended_at": now_iso()})
    session = get(session_id)
    if not session["approval_ids"]:
        flow.update(session["run_id"], stage="VERIFIED", status="COMPLETED",
                    action=f"Call monitored — final verdict {session['verdict']} ({session['risk']}/100)",
                    verified=f"{len(session['transcript'])} utterances analysed, {len(session['signals'])} red flags")
    audit.record(f"Scam Shield ended — {session['verdict']} ({session['risk']}/100)", agent="financial_safety", tool="scam_shield",
                 status="INFO", kind="shield", run_id=session["run_id"])
    return session


# ── simulation: a scripted scam call voiced by Sarvam ──────────────────────────
def simulate(scenario: str = "digital_arrest", user_id: str = "U001", pace: float = 1.0) -> dict:
    spec = SCENARIOS.get(scenario) or SCENARIOS["digital_arrest"]
    session = start(user_id, "simulation", spec["caller"], scenario)
    threading.Thread(target=_play_script, args=(session["session_id"], spec, pace), daemon=True).start()
    return session


def _play_script(session_id: str, spec: dict, pace: float) -> None:
    time.sleep(1.0 * pace)
    for speaker, text, speech in spec["lines"]:
        session = get(session_id)
        if not session or session["status"] != "LISTENING":
            return
        audio_id = sarvam.speak(speech or text, spec["language"], speaker=VOICES[speaker])
        ingest(session_id, text, speaker, f"/api/audio/{audio_id}" if audio_id else None)
        time.sleep(max(2.2, len(speech or text) / 13) * pace)  # roughly how long the line takes to say
    time.sleep(2.5 * pace)
    end(session_id)


def recent(limit: int = 5) -> list[dict]:
    return list(reversed(store.all("Shield Sessions")))[:limit]


def active_for(user_id: str) -> dict | None:
    return next((s for s in reversed(store.all("Shield Sessions")) if s["user_id"] == user_id and s["status"] == "LISTENING"), None)
