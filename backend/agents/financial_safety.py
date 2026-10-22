"""Financial Safety Agent — detect → verify → ask → block → case → notify → log."""
from __future__ import annotations

from backend.agents.base import CONSUMER_ID, AgentResult, Proposal
from backend.services.store import store
from backend.tools.registry import call, ok
from backend.utils.helpers import clock12, inr, now_iso, today

AGENT = "financial_safety"


def inject_suspicious_transaction(user_id: str = CONSUMER_ID, amount: float = 25000, time: str = "23:47",
                                  recipient: str = "QuickCash Rewards", recipient_id: str = "quickcash.rewards@ybl") -> dict:
    txn = {
        "txn_id": store.next_id("TXN"),
        "user_id": user_id,
        "amount": amount,
        "recipient": recipient,
        "recipient_id": recipient_id,
        "date": today().isoformat(),
        "days_ago": 0,
        "time": time,
        "channel": "UPI",
        "status": "PENDING",
        "risk_score": None,
        "is_new_recipient": True,
        "device": "new",
        "created_at": now_iso(),
        "simulated": True,
    }
    store.insert("Transactions", txn)
    return txn


def assess(txn_id: str) -> AgentResult:
    txn = ok(call("get_transaction", txn_id=txn_id))
    recipient = ok(call("verify_recipient", recipient_id=txn["recipient_id"], user_id=txn["user_id"]))
    risk = ok(call("calculate_transaction_risk", txn_id=txn_id))
    high = risk["risk_level"] == "HIGH"
    result = AgentResult(
        agent=AGENT,
        intent="fraud_check",
        user_id=txn["user_id"],
        headline=f"{inr(txn['amount'])} at {clock12(txn['time'])} to a new recipient — risk {risk['risk_score']}/100 {risk['risk_level']}",
        findings=[f["detail"] for f in risk["factors"]],
        data=[("Amount", inr(txn["amount"])), ("Time", clock12(txn["time"])), ("Recipient", f"{txn['recipient']} (new)"),
              ("Historical average", inr(risk["historical_average"])), ("Risk", f"{risk['risk_score']}/100 {risk['risk_level']}")],
        decision="High risk → verify with the user by voice before anything else" if high else "Low risk — no action needed",
        facts={"txn": txn, "risk": risk, "recipient": recipient},
        priority=3 if high else 1,
    )
    if high and txn["status"] in {"PENDING", "FLAGGED"}:
        result.proposals.append(fraud_proposal(txn, risk))
    result.replies = {
        "en": f"Alert: a {inr(txn['amount'])} payment to {txn['recipient']} was attempted at {txn['time']}. "
              f"That's {risk['historical_average'] and round(txn['amount'] / risk['historical_average'])}× your usual spend and a new recipient — risk {risk['risk_score']}/100. "
              "Did you make this payment? If not, I can block it and register a fraud complaint.",
        "hi": f"Alert: {txn['time']} baje {inr(txn['amount'])} ka payment ek naye recipient ko try hua hai. Risk {risk['risk_score']}/100 hai. "
              "Kya yeh aapne kiya? Agar nahi, toh main ise block karke fraud complaint register kar sakta hoon.",
        "kn": f"Namaskara, nimma account nalli {inr(txn['amount'])} transaction attempt aagide ({txn['time']}, hosa recipient). "
              f"Risk {risk['risk_score']}/100. Idu neevu maadidira? Illa andre block maadi fraud complaint register maadtini.",
    }
    return result


def fraud_proposal(txn: dict, risk: dict) -> Proposal:
    return Proposal(
        action="FREEZE_TRANSACTION",
        description=f"Block {inr(txn['amount'])} payment to {txn['recipient']} and register a fraud complaint",
        params={"txn_id": txn["txn_id"], "user_id": txn["user_id"], "risk_score": risk["risk_score"]},
        amount=txn["amount"],
        impact=f"Prevents a potential loss of {inr(txn['amount'])}",
        target=txn["recipient"],
        reason=f"Risk {risk['risk_score']}/100 — " + "; ".join(f["detail"] for f in risk["factors"][:3]),
    )


def handle(intent: str, entities: dict, user_id: str) -> AgentResult:
    suspicious = [t for t in store.all("Transactions", user_id=user_id) if t["status"] in {"PENDING", "FLAGGED"}]
    if suspicious:
        return assess(suspicious[-1]["txn_id"])
    recent = [t for t in store.all("Transactions", user_id=user_id)][-5:]
    frozen = [t for t in store.all("Transactions", user_id=user_id) if t["status"] == "FROZEN"]
    msg_en = ("No suspicious transactions right now. " + (f"{len(frozen)} blocked transaction(s) are under investigation. " if frozen else "") +
              "Remember: SAATHI never asks for your OTP, PIN or CVV.")
    return AgentResult(
        agent=AGENT, intent=intent, user_id=user_id, headline="No suspicious activity",
        data=[("Recent transactions", len(recent)), ("Blocked", len(frozen))],
        decision="Nothing to act on",
        replies={"en": msg_en,
                 "hi": "Abhi koi suspicious transaction nahi hai. Yaad rakhiye: SAATHI kabhi OTP, PIN ya CVV nahi maangta.",
                 "kn": "Sadhyakke yaavude suspicious transaction illa. Nenapidi: SAATHI yavaagloo OTP, PIN, CVV keLalla."},
    )
