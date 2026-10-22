"""Payment Reliability Agent — PREDICTION → ACTION."""
from __future__ import annotations

import math

from backend.agents.base import AgentResult, Proposal
from backend.tools.registry import call, ok
from backend.utils.helpers import inr

AGENT = "payment_reliability"


def plan_amount(shortfall: float) -> int:
    """Cover the shortfall plus a 25% buffer, rounded up to ₹500."""
    return int(math.ceil(shortfall * 1.25 / 500) * 500)


def handle(intent: str, entities: dict, user_id: str) -> AgentResult:
    mandates = ok(call("get_recurring_payments", user_id=user_id))["payments"]
    ok(call("get_balance_history", user_id=user_id))
    income = ok(call("find_upcoming_income", user_id=user_id))["income"][0]
    candidates = [m for m in mandates if m["status"] == "ACTIVE" and m["due_in_days"] <= 15]
    predictions = [ok(call("predict_payment_failure", user_id=user_id, rp_id=m["rp_id"])) for m in candidates[:2]]
    worst = max(predictions, key=lambda p: p["failure_probability"]) if predictions else None
    result = AgentResult(agent=AGENT, intent=intent, user_id=user_id)
    if not worst or worst["risk"] == "LOW":
        result.headline, result.decision = "All upcoming payments look safe", "No action needed"
        result.replies = {"en": "All your upcoming payments are on track.", "hi": "Aapke sab upcoming payments safe hain.",
                          "kn": "Nimma ella upcoming payments safe ide."}
        return result
    shortfall = ok(call("calculate_payment_shortfall", user_id=user_id, rp_id=worst["rp_id"]))
    transfer = plan_amount(shortfall["shortfall"])
    p = round(worst["failure_probability"] * 100)
    result.priority = 3
    result.headline = f"{inr(worst['amount'])} {worst['payment']} due in {worst['due_in_days']} days — {p}% failure risk, shortfall {inr(shortfall['shortfall'])}"
    result.findings = [f"Expected balance on due date {inr(shortfall['projected_balance'])}",
                       f"Salary {inr(income['amount'])} arrives in {income['in_days']} days — after the due date"]
    result.data = [("Upcoming payment", inr(worst["amount"])), ("Due", f"{worst['due_date']} ({worst['due_in_days']} days)"),
                   ("Current balance", inr(shortfall["projected_balance"])), ("Predicted shortfall", inr(shortfall["shortfall"])),
                   ("Failure probability", f"{p}%"), ("Risk", worst["risk"])]
    result.decision = f"Sweep {inr(transfer)} from savings the day before (shortfall + 25% buffer)"
    result.facts = {"prediction": worst, "shortfall": shortfall, "transfer": transfer, "income": income}
    result.proposals.append(Proposal(
        action="CREATE_PAYMENT_PLAN", description=f"Move {inr(transfer)} from savings before the {inr(worst['amount'])} AutoPay on {worst['due_date']}",
        params={"user_id": user_id, "rp_id": worst["rp_id"], "transfer_amount": transfer, "prev_probability": worst["failure_probability"]},
        amount=transfer, target=worst["payment"], impact=f"Avoids mandate failure + bounce charges; risk {p}% → low",
        reason=f"Balance {inr(shortfall['projected_balance'])} vs {inr(worst['amount'])} due; salary lands after due date"))
    result.replies = {
        "en": f"Your {inr(worst['amount'])} payment is likely to fail because your expected balance is {inr(shortfall['projected_balance'])}. "
              f"There may be a {inr(shortfall['shortfall'])} shortfall. Would you like me to move {inr(transfer)} from savings the day before?",
        "hi": f"Aapka {inr(worst['amount'])} ka payment fail ho sakta hai — balance sirf {inr(shortfall['projected_balance'])} hai, {inr(shortfall['shortfall'])} kam. Savings se {inr(transfer)} move karoon?",
        "kn": f"Nimma {inr(worst['amount'])} payment fail aagbahudu — balance {inr(shortfall['projected_balance'])} maatra, {inr(shortfall['shortfall'])} kammi. Savings-inda {inr(transfer)} move maadla?",
    }
    return result
