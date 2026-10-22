"""Financial Safety Agent tools — fraud detection and response (sandboxed)."""
from __future__ import annotations

from statistics import mean

from backend.integrations.telegram import telegram
from backend.services.store import store
from backend.tools.registry import ToolError, tool
from backend.utils.helpers import inr, now_iso

AGENT = "financial_safety"

# Simulated recipient intelligence (would be a bank / NPCI risk API in production).
RECIPIENT_REGISTRY = {
    "quickcash.rewards@ybl": {"name": "QuickCash Rewards", "account_age_days": 2, "fraud_reports": 3, "kyc": "minimal"},
}


@tool("get_user", "system")
def get_user(user_id: str) -> dict:
    """Fetch a user profile."""
    user = store.get("Users", user_id)
    if not user:
        raise ToolError(f"user {user_id} not found")
    return user


@tool("get_transaction", AGENT)
def get_transaction(txn_id: str) -> dict:
    """Fetch one transaction."""
    txn = store.get("Transactions", txn_id)
    if not txn:
        raise ToolError(f"transaction {txn_id} not found")
    return txn


@tool("verify_recipient", AGENT)
def verify_recipient(recipient_id: str, user_id: str) -> dict:
    """Check whether the recipient is known to the user and what risk intelligence says."""
    past = [t for t in store.all("Transactions", user_id=user_id) if t["recipient_id"] == recipient_id and t["status"] == "COMPLETED"]
    intel = RECIPIENT_REGISTRY.get(recipient_id, {"account_age_days": 900, "fraud_reports": 0, "kyc": "full"})
    verified = bool(past) and intel["fraud_reports"] == 0
    return {
        "recipient_id": recipient_id,
        "known_to_user": bool(past),
        "previous_payments": len(past),
        "account_age_days": intel["account_age_days"],
        "fraud_reports": intel["fraud_reports"],
        "kyc": intel["kyc"],
        "verified": verified,
        "summary": "verified recipient" if verified else f"UNVERIFIED · {intel['fraud_reports']} fraud reports · account {intel['account_age_days']}d old",
    }


@tool("calculate_transaction_risk", AGENT)
def calculate_transaction_risk(txn_id: str) -> dict:
    """Deterministic, explainable risk score (0–100) for a transaction."""
    txn = store.get("Transactions", txn_id)
    if not txn:
        raise ToolError(f"transaction {txn_id} not found")
    history = [t["amount"] for t in store.all("Transactions", user_id=txn["user_id"])
               if t["txn_id"] != txn_id and t["status"] == "COMPLETED"]
    avg = round(mean(history)) if history else txn["amount"]
    ratio = txn["amount"] / avg if avg else 1
    hour = int(txn["time"].split(":")[0])
    intel = RECIPIENT_REGISTRY.get(txn["recipient_id"], {"fraud_reports": 0, "account_age_days": 900})

    factors = []
    if ratio >= 20:
        factors.append(("amount", 35, f"{inr(txn['amount'])} is {ratio:.0f}× the usual {inr(avg)}"))
    elif ratio >= 5:
        factors.append(("amount", 20, f"{ratio:.1f}× usual spend"))
    if hour >= 23 or hour < 5:
        factors.append(("time", 18, f"Late-night attempt at {txn['time']}"))
    if txn.get("is_new_recipient"):
        factors.append(("recipient", 20, "First payment to this recipient"))
    if intel["fraud_reports"] > 0:
        factors.append(("intel", 15, f"Recipient has {intel['fraud_reports']} fraud reports, account {intel['account_age_days']} days old"))
    if txn.get("device") == "new":
        factors.append(("device", 3, "Unrecognised device"))
    score = min(100, sum(w for _, w, _ in factors))
    level = "HIGH" if score >= 75 else "MEDIUM" if score >= 45 else "LOW"
    store.update("Transactions", txn_id, {"risk_score": score, "risk_level": level})
    return {
        "txn_id": txn_id,
        "amount": txn["amount"],
        "historical_average": avg,
        "risk_score": score,
        "risk_level": level,
        "factors": [{"factor": f, "weight": w, "detail": d} for f, w, d in factors],
        "summary": f"Risk {score}/100 {level}",
    }


@tool("calculate_payment_risk", AGENT)
def calculate_payment_risk(user_id: str, amount: float, recipient_id: str) -> dict:
    """Pre-payment check: score a payment the user is *about* to make."""
    history = [t["amount"] for t in store.all("Transactions", user_id=user_id) if t["status"] == "COMPLETED"]
    avg = mean(history) if history else amount
    known = any(t["recipient_id"] == recipient_id for t in store.all("Transactions", user_id=user_id))
    intel = RECIPIENT_REGISTRY.get(recipient_id, {"fraud_reports": 0})
    score = min(100, (30 if amount > 10 * avg else 10 if amount > 3 * avg else 0) + (25 if not known else 0) + (35 if intel["fraud_reports"] else 0))
    return {"risk_score": score, "risk_level": "HIGH" if score >= 60 else "MEDIUM" if score >= 30 else "LOW",
            "summary": f"Payment risk {score}/100"}


@tool("freeze_transaction", AGENT, mutates=True)
def freeze_transaction(txn_id: str, reason: str) -> dict:
    """Hold a pending transaction (sandbox — no real bank call)."""
    txn = store.get("Transactions", txn_id)
    if not txn:
        raise ToolError(f"transaction {txn_id} not found")
    if txn["status"] not in {"PENDING", "FLAGGED"}:
        raise ToolError(f"transaction is {txn['status']}, cannot freeze")
    updated = store.update("Transactions", txn_id, {"status": "FROZEN", "frozen_at": now_iso(), "freeze_reason": reason})
    return {"txn_id": txn_id, "status": updated["status"], "simulated": True, "summary": f"{txn_id} FROZEN"}


@tool("create_fraud_case", AGENT, mutates=True)
def create_fraud_case(txn_id: str, user_id: str, summary: str, risk_score: int) -> dict:
    """Open a fraud complaint case (sandbox)."""
    txn = store.get("Transactions", txn_id)
    if not txn:
        raise ToolError(f"transaction {txn_id} not found")
    case = {
        "case_id": store.next_id("FRD"),
        "txn_id": txn_id,
        "user_id": user_id,
        "amount": txn["amount"],
        "recipient": txn["recipient"],
        "risk_score": risk_score,
        "summary": summary,
        "status": "OPEN",
        "created_at": now_iso(),
        "reference": "Cybercrime helpline 1930 · cybercrime.gov.in",
        "simulated": True,
    }
    store.insert("Fraud Cases", case)
    store.update("Transactions", txn_id, {"fraud_case_id": case["case_id"]})
    return {**case, "summary": f"Fraud case {case['case_id']} opened"}


@tool("send_fraud_alert", AGENT, mutates=True)
def send_fraud_alert(user_id: str, txn_id: str, case_id: str) -> dict:
    """Notify the user on Telegram that the transaction was blocked."""
    txn = store.get("Transactions", txn_id) or {}
    text = (f"🛡️ <b>SAATHI Fraud Alert</b>\n\nA {inr(txn.get('amount'))} payment to {txn.get('recipient')} at {txn.get('time')} "
            f"was <b>blocked</b> after you confirmed you did not make it.\n\nCase: <b>{case_id}</b>\nStatus: Transaction frozen\n\n"
            "SAATHI will never ask for your OTP, PIN or CVV.")
    message = telegram.send(role="user", title="Fraud alert", text=text, related_id=case_id)
    return {"message_id": message["message_id"], "queued_for_telegram": message["will_deliver"], "simulated": message["simulated"],
            "summary": "Telegram alert " + ("sent" if message["will_deliver"] else "shown in dashboard outbox")}
