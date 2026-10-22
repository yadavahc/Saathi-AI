"""Live AI call — fraud voice verification.

Transaction → risk analysis → HIGH → call (Vobiz, or simulated) → Sarvam voice →
user verification → approval → fraud action. Each SAATHI line is synthesised with
Sarvam TTS in the background and attached to the transcript as audio.
"""
from __future__ import annotations

import re
import threading

from backend.agents import financial_safety
from backend.agents.base import CONSUMER_ID
from backend.integrations.sarvam import sarvam
from backend.integrations.vobiz import vobiz
from backend.services import approvals, audit, flow
from backend.services.store import store
from backend.utils.helpers import clock12, inr, now_iso

NO_WORDS = r"\b(no|nope|nahi|nahin|illa|illla|illaa|beda|illai|ledu|kaadu|na|not me|didn'?t|maadilla|maadlilla|never)\b"
YES_WORDS = r"\b(yes|yeah|haan|ha|han|howdu|houdu|haudu|sari|hoon|aamam|avunu|ok|okay|confirm|please|block|maadi|karo)\b"

LINES = {
    "ask": ("Namaskara {name}, nimma account nalli {amount} transaction attempt aagide — {time}, hosa recipient-ge. Idu neevu maadidira?",
            "ನಮಸ್ಕಾರ {name}, ನಿಮ್ಮ ಅಕೌಂಟ್‌ನಲ್ಲಿ {amount} ಟ್ರಾನ್ಸಾಕ್ಷನ್ ಪ್ರಯತ್ನ ಆಗಿದೆ — {time}ಕ್ಕೆ, ಹೊಸ ರಿಸಿಪಿಯಂಟ್‌ಗೆ. ಇದು ನೀವು ಮಾಡಿದ್ದೀರಾ?"),
    "confirm": ("Sari. Transaction-na block maadi fraud complaint register maadla?",
                "ಸರಿ. ಟ್ರಾನ್ಸಾಕ್ಷನ್‌ನ ಬ್ಲಾಕ್ ಮಾಡಿ ಫ್ರಾಡ್ ಕಂಪ್ಲೇಂಟ್ ರಿಜಿಸ್ಟರ್ ಮಾಡ್ಲಾ?"),
    "done": ("Transaction block aagide. Complaint number {case}. Telegram alli alert kalisiddini. Nenapidi — SAATHI yavaagloo OTP keLalla.",
             "ಟ್ರಾನ್ಸಾಕ್ಷನ್ ಬ್ಲಾಕ್ ಆಗಿದೆ. ಕಂಪ್ಲೇಂಟ್ ನಂಬರ್ {case}. ಟೆಲಿಗ್ರಾಮ್‌ನಲ್ಲಿ ಅಲರ್ಟ್ ಕಳಿಸಿದ್ದೀನಿ. ನೆನಪಿಡಿ — ಸಾಥಿ ಯಾವತ್ತೂ OTP ಕೇಳಲ್ಲ."),
    "genuine": ("Dhanyavaada. Transaction-na continue maadtini.", "ಧನ್ಯವಾದ. ಟ್ರಾನ್ಸಾಕ್ಷನ್ ಮುಂದುವರಿಸ್ತೀನಿ."),
    "declined": ("Sari, yaavude action thegedukolla. Sandeha bandre 1930 ge call maadi.",
                 "ಸರಿ, ಯಾವುದೇ ಆಕ್ಷನ್ ತಗೊಳ್ಳಲ್ಲ. ಸಂದೇಹ ಬಂದರೆ 1930ಗೆ ಕಾಲ್ ಮಾಡಿ."),
    "repeat": ("Kshamisi, artha aagilla. Dayavittu 'howdu' athava 'illa' antha heli.",
               "ಕ್ಷಮಿಸಿ, ಅರ್ಥ ಆಗಿಲ್ಲ. ದಯವಿಟ್ಟು 'ಹೌದು' ಅಥವಾ 'ಇಲ್ಲ' ಅಂತ ಹೇಳಿ."),
    "failed": ("Kshamisi, block maadoke aagilla. Nimma bank-ge call maadi athava 1930 ge call maadi.",
               "ಕ್ಷಮಿಸಿ, ಬ್ಲಾಕ್ ಮಾಡೋಕೆ ಆಗಿಲ್ಲ. ನಿಮ್ಮ ಬ್ಯಾಂಕ್‌ಗೆ ಅಥವಾ 1930ಗೆ ಕಾಲ್ ಮಾಡಿ."),
}


def _say(call_id: str, key: str, **fmt) -> dict:
    text, speech = (s.format(**fmt) for s in LINES[key])
    entry = {"speaker": "SAATHI", "text": text, "speech_text": speech, "audio_url": None, "ts": now_iso()}
    store.mutate("Calls", call_id, lambda c: c["transcript"].append(entry))
    index = len((store.get("Calls", call_id) or {"transcript": []})["transcript"]) - 1

    def synth():
        audio_id = sarvam.speak(speech, "kn-IN")
        if audio_id:
            store.mutate("Calls", call_id, lambda c: c["transcript"][index].update({"audio_url": f"/api/audio/{audio_id}"}))

    threading.Thread(target=synth, daemon=True).start()
    return entry


def start_fraud_flow(txn_id: str) -> dict:
    """System event entry point: assess a new transaction; call the user if HIGH risk."""
    txn = store.get("Transactions", txn_id)
    run = flow.start(f"SYSTEM EVENT · {inr(txn['amount'])} UPI payment attempt at {txn['time']} to {txn['recipient']}",
                     source="event", user_id=txn["user_id"], channel="voice", language="kanglish")
    run_id = run["run_id"]
    with flow.bind(run_id):
        flow.stage(run_id, "UNDERSTOOD", understood={"intents": ["fraud_check"], "agents": ["financial_safety"],
                                                     "entities": {"amount": txn["amount"], "txn_id": txn_id},
                                                     "risk_level": "PENDING", "engine": "event", "reasoning": "New outgoing transaction"})
        result = financial_safety.assess(txn_id)
        for label, value in result.data:
            flow.add_data(run_id, label, value)
        risk = result.facts["risk"]
        flow.stage(run_id, "DECIDED", decision=result.decision, agents=["financial_safety"])
        audit.record(f"Fraud detected: {result.headline}" if risk["risk_level"] == "HIGH" else f"Transaction cleared: {result.headline}",
                     agent="financial_safety", intent="fraud_check", status="WARNING" if risk["risk_level"] == "HIGH" else "INFO",
                     kind="detection", run_id=run_id)
        if risk["risk_level"] != "HIGH":
            store.update("Transactions", txn_id, {"status": "COMPLETED"})
            flow.update(run_id, stage="VERIFIED", status="COMPLETED", verified="Low risk — payment allowed")
            return {"run_id": run_id, "risk": risk, "call": None}
        store.update("Transactions", txn_id, {"status": "FLAGGED"})
        user = store.get("Users", txn["user_id"]) or {"name": "Rahul"}
        call_row = {
            "call_id": store.next_id("CALL"),
            "user_id": txn["user_id"],
            "user": user["name"],
            "language": "Kannada",
            "language_code": "kn-IN",
            "status": "CONNECTED",
            "reason": "FRAUD VERIFICATION",
            "risk": f"{risk['risk_score']}/100 {risk['risk_level']}",
            "current_step": "VERIFYING TRANSACTION",
            "step": "verify",
            "txn_id": txn_id,
            "run_id": run_id,
            "approval_id": "",
            "transcript": [],
            "tool_results": [],
            "provider": "vobiz" if vobiz.enabled else "simulated",
            "started_at": now_iso(),
            "ended_at": "",
            "proposal": {"risk_score": risk["risk_score"]},
        }
        store.insert("Calls", call_row)
        placed = vobiz.place_call(call_row["call_id"])
        if placed.get("placed"):
            store.update("Calls", call_row["call_id"], {"status": "RINGING", "provider": "vobiz"})
        audit.record(f"Voice verification call started ({call_row['provider']})", agent="financial_safety", tool="vobiz_call",
                     status="INFO", kind="call", run_id=run_id)
        _say(call_row["call_id"], "ask", name=user["name"], amount=inr(txn["amount"]), time=clock12(txn["time"]))
        store.update("Calls", call_row["call_id"], {"current_step": "WAITING FOR USER RESPONSE"})
        return {"run_id": run_id, "risk": risk, "call": store.get("Calls", call_row["call_id"])}


def _classify(text: str, prefer: str) -> str | None:
    t = text.lower()
    no, yes = bool(re.search(NO_WORDS, t)), bool(re.search(YES_WORDS, t))
    if re.search(r"[ಇ]ಲ್ಲ|नहीं|ಬೇಡ", text):
        no = True
    if re.search(r"ಹೌದು|ಸರಿ|हाँ|हां", text):
        yes = True
    if no and yes:
        return prefer
    return "no" if no else "yes" if yes else None


def respond(call_id: str, text: str, by: str = "user (voice)") -> dict:
    call_row = store.get("Calls", call_id)
    if not call_row:
        raise KeyError(call_id)
    if call_row["status"] == "COMPLETED":
        return call_row
    store.mutate("Calls", call_id, lambda c: c["transcript"].append({"speaker": "USER", "text": text, "ts": now_iso()}))
    run_id = call_row["run_id"]
    with flow.bind(run_id):
        if call_row["step"] == "verify":
            answer = _classify(text, prefer="no")
            if answer == "no":
                audit.record("User denied the transaction by voice", agent="financial_safety", decision="USER_DENIED", status="WARNING",
                             kind="call", run_id=run_id)
                txn = store.get("Transactions", call_row["txn_id"])
                prop = financial_safety.fraud_proposal(txn, {"risk_score": call_row["proposal"]["risk_score"],
                                                             "factors": [{"detail": "User denied the transaction by voice"}]})
                approval = approvals.propose(action=prop.action, description=prop.description, agent="financial_safety",
                                             params=prop.params, amount=prop.amount, impact=prop.impact, target=prop.target,
                                             reason=prop.reason, user_id=txn["user_id"], run_id=run_id)
                flow.stage(run_id, "APPROVAL", status="AWAITING_APPROVAL")
                store.update("Calls", call_id, {"step": "confirm", "approval_id": approval["approval_id"],
                                                "current_step": "WAITING FOR CONFIRMATION"})
                _say(call_id, "confirm")
            elif answer == "yes":
                store.update("Transactions", call_row["txn_id"], {"status": "COMPLETED", "verified_by_user": True})
                flow.update(run_id, stage="VERIFIED", status="COMPLETED", action="User confirmed the payment — released",
                            verified="Transactions.status = COMPLETED")
                _say(call_id, "genuine")
                _end(call_id)
            else:
                _say(call_id, "repeat")
        elif call_row["step"] == "confirm":
            answer = _classify(text, prefer="yes")
            if answer is None:
                _say(call_id, "repeat")
            else:
                result = approvals.decide(call_row["approval_id"], answer == "yes", by=f"{call_row['user']} (voice)", channel="voice")
                finish_after_decision(call_id, result)
    return store.get("Calls", call_id)


_finish_lock = threading.Lock()


def finish_after_decision(call_id: str, approval: dict) -> None:
    with _finish_lock:
        call_row = store.get("Calls", call_id)
        if not call_row or call_row["status"] == "COMPLETED" or call_row.get("closing"):
            return
        store.update("Calls", call_id, {"closing": True})
    if approval["status"] == "EXECUTED":
        steps = (approval.get("result") or {}).get("steps", [])
        store.update("Calls", call_id, {"tool_results": [{"name": s["tool"] + "()", "status": s["status"]} for s in steps] +
                                        [{"name": "send_telegram()", "status": "SUCCESS"}],
                                        "current_step": "ACTION COMPLETED"})
        _say(call_id, "done", case=(approval.get("result") or {}).get("case_id", ""))
    elif approval["status"] == "REJECTED":
        _say(call_id, "declined")
    else:
        _say(call_id, "failed")
    _end(call_id)


def on_approval_decided(approval: dict) -> None:
    """If a fraud approval is decided outside the call (dashboard/Telegram), close the call too."""
    if approval["action"] != "FREEZE_TRANSACTION" or approval.get("channel") == "voice":
        return
    for call_row in store.all("Calls"):
        if call_row["approval_id"] == approval["approval_id"] and call_row["status"] != "COMPLETED":
            def later(cid=call_row["call_id"], aid=approval["approval_id"]):
                result = approvals.wait(aid, 30)
                finish_after_decision(cid, result)
            threading.Thread(target=later, daemon=True).start()


def _end(call_id: str) -> None:
    store.update("Calls", call_id, {"status": "COMPLETED", "ended_at": now_iso(),
                                    "current_step": (store.get("Calls", call_id) or {}).get("current_step", "ENDED")})


def active() -> list[dict]:
    return [c for c in store.all("Calls") if c["status"] != "COMPLETED"]


def latest() -> dict | None:
    rows = store.all("Calls")
    return rows[-1] if rows else None


approvals.on("decided", on_approval_decided)

__all__ = ["start_fraud_flow", "respond", "active", "latest", "CONSUMER_ID"]
