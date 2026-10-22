"""Payment Reliability Agent tools — predict failures before they happen."""
from __future__ import annotations

import math

from backend.services.store import store
from backend.tools.registry import ToolError, tool
from backend.utils.helpers import day_offset, inr, now_iso

AGENT = "payment_reliability"


def failure_probability(projected_balance: float, amount: float, past_failures: int) -> float:
    """Logistic on balance coverage; past mandate failures nudge it up."""
    coverage = projected_balance / amount if amount else 10
    p = 1 / (1 + math.exp(8 * (coverage - 0.82)))
    return min(0.99, p + 0.01 * past_failures)


@tool("get_balance_history", AGENT)
def get_balance_history(user_id: str, days: int = 30) -> dict:
    """Daily closing balance for the last N days (derived from the ledger)."""
    fin = store.get("Financial Data", user_id)
    if not fin:
        raise ToolError(f"no financial data for {user_id}")
    current = fin["current_balance"]
    series = []
    for i in range(days, -1, -1):
        # Salary landed ~21 days ago; spending draws the balance down linearly.
        if i > 21:
            value = 6400 - (days - i) * 180
        else:
            value = current + i * 1080
        series.append({"date": day_offset(-i), "balance": round(value if i else current)})
    return {"series": series, "current": current, "summary": f"Balance today {inr(current)}"}


@tool("get_recurring_payments", AGENT)
def get_recurring_payments(user_id: str) -> dict:
    """All active mandates (UPI AutoPay / NACH)."""
    rows = sorted(store.all("Recurring Payments", user_id=user_id), key=lambda r: r["due_in_days"])
    return {"payments": rows, "summary": f"{len(rows)} active mandates"}


@tool("find_upcoming_income", AGENT)
def find_upcoming_income(user_id: str) -> dict:
    """Expected credits (salary) and when they land."""
    fin = store.get("Financial Data", user_id)
    if not fin:
        raise ToolError(f"no financial data for {user_id}")
    return {"income": [{"source": "Salary", "amount": fin["monthly_income"], "in_days": fin["salary_in_days"], "date": fin["salary_date"]}],
            "summary": f"Salary {inr(fin['monthly_income'])} in {fin['salary_in_days']} days"}


@tool("calculate_payment_shortfall", AGENT)
def calculate_payment_shortfall(user_id: str, rp_id: str) -> dict:
    """Projected balance on the due date vs the amount due."""
    fin = store.get("Financial Data", user_id)
    rp = store.get("Recurring Payments", rp_id)
    if not fin or not rp:
        raise ToolError("unknown user or mandate")
    income_before = fin["monthly_income"] if fin["salary_in_days"] <= rp["due_in_days"] else 0
    earlier = sum(r["amount"] for r in store.all("Recurring Payments", user_id=user_id)
                  if r["rp_id"] != rp_id and r["due_in_days"] < rp["due_in_days"] and r["status"] == "ACTIVE")
    plan_topup = sum(p["transfer_amount"] for p in store.all("Payment Plans", rp_id=rp_id) if p["status"] == "ACTIVE")
    projected = fin["current_balance"] + income_before - earlier + plan_topup
    return {"rp_id": rp_id, "amount": rp["amount"], "projected_balance": projected, "shortfall": max(0, rp["amount"] - projected),
            "income_before_due": income_before, "summary": f"Projected {inr(projected)} vs {inr(rp['amount'])} due"}


@tool("predict_payment_failure", AGENT, mutates=True)
def predict_payment_failure(user_id: str, rp_id: str) -> dict:
    """Failure probability for a mandate; stores the prediction."""
    rp = store.get("Recurring Payments", rp_id)
    if not rp:
        raise ToolError(f"{rp_id} not found")
    fin = store.get("Financial Data", user_id)
    income_before = fin["monthly_income"] if fin["salary_in_days"] <= rp["due_in_days"] else 0
    plan_topup = sum(p["transfer_amount"] for p in store.all("Payment Plans", rp_id=rp_id) if p["status"] == "ACTIVE")
    projected = fin["current_balance"] + income_before + plan_topup
    p = failure_probability(projected, rp["amount"], rp["past_failures"])
    risk = "HIGH" if p >= 0.6 else "MEDIUM" if p >= 0.3 else "LOW"
    prediction = {
        "prediction_id": store.next_id("PRD"),
        "user_id": user_id,
        "rp_id": rp_id,
        "payment": rp["name"],
        "amount": rp["amount"],
        "due_date": rp["due_date"],
        "due_in_days": rp["due_in_days"],
        "projected_balance": projected,
        "shortfall": max(0, rp["amount"] - projected),
        "failure_probability": round(p, 2),
        "risk": risk,
        "created_at": now_iso(),
    }
    store.insert("Payment Predictions", prediction)
    return {**prediction, "summary": f"{round(p * 100)}% failure risk ({risk})"}


@tool("create_payment_plan", AGENT, mutates=True)
def create_payment_plan(user_id: str, rp_id: str, transfer_amount: float, source: str = "savings") -> dict:
    """Schedule a sweep from savings one day before the due date (sandbox)."""
    rp = store.get("Recurring Payments", rp_id)
    fin = store.get("Financial Data", user_id)
    if not rp or not fin:
        raise ToolError("unknown user or mandate")
    if transfer_amount > fin["savings_balance"]:
        raise ToolError("insufficient savings for the sweep")
    plan = {
        "plan_id": store.next_id("PLN"),
        "user_id": user_id,
        "rp_id": rp_id,
        "payment": rp["name"],
        "transfer_amount": transfer_amount,
        "source": source,
        "scheduled_for": day_offset(max(0, rp["due_in_days"] - 1)),
        "status": "ACTIVE",
        "created_at": now_iso(),
        "simulated": True,
    }
    store.insert("Payment Plans", plan)
    return {**plan, "summary": f"{plan['plan_id']}: sweep {inr(transfer_amount)} from {source} on {plan['scheduled_for']}"}
