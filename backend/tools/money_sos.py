"""Money SOS Agent tools — urgent financial needs."""
from __future__ import annotations

from backend.services.store import store
from backend.tools.registry import ToolError, tool
from backend.utils.helpers import inr, now_iso

AGENT = "money_sos"


def _fin(user_id: str) -> dict:
    fin = store.get("Financial Data", user_id)
    if not fin:
        raise ToolError(f"no financial data for {user_id}")
    return fin


@tool("get_financial_summary", AGENT)
def get_financial_summary(user_id: str) -> dict:
    """Savings, balances, income and credit available."""
    fin = _fin(user_id)
    return {
        "savings_balance": fin["savings_balance"],
        "current_balance": fin["current_balance"],
        "monthly_income": fin["monthly_income"],
        "salary_date": fin["salary_date"],
        "monthly_emi": fin["monthly_emi"],
        "preapproved_loan": fin["preapproved_loan"],
        "summary": f"Savings {inr(fin['savings_balance'])}, balance {inr(fin['current_balance'])}",
    }


@tool("get_insurance_details", AGENT)
def get_insurance_details(user_id: str) -> dict:
    """Active insurance policy and coverage."""
    fin = _fin(user_id)
    return {"policy": fin["insurance_policy"], "policy_no": fin["insurance_policy_no"],
            "coverage": fin["insurance_coverage"], "covers": fin["insurance_covers"],
            "summary": f"{fin['insurance_policy']} · cover {inr(fin['insurance_coverage'])}"}


@tool("get_upcoming_payments", AGENT)
def get_upcoming_payments(user_id: str, within_days: int = 30) -> dict:
    """Recurring obligations due soon."""
    rows = [r for r in store.all("Recurring Payments", user_id=user_id) if r["status"] == "ACTIVE" and r["due_in_days"] <= within_days]
    rows.sort(key=lambda r: r["due_in_days"])
    return {"payments": rows, "total": sum(r["amount"] for r in rows),
            "summary": f"{len(rows)} payments due · {inr(sum(r['amount'] for r in rows))}"}


@tool("find_funding_options", AGENT)
def find_funding_options(user_id: str, amount: float, purpose: str = "unknown") -> dict:
    """Builds a safe funding plan: insurance first, then savings above the buffer, then credit."""
    fin = _fin(user_id)
    upcoming = [r for r in store.all("Recurring Payments", user_id=user_id) if r["due_in_days"] <= 30]
    reserve = max(fin["emergency_buffer"], fin["monthly_emi"])  # never empty savings below next EMI
    usable_savings = max(0, fin["savings_balance"] - reserve)
    medical = purpose in {"medical", "hospital", "health", "surgery"}
    plan, remaining = [], amount
    if medical:
        claim = min(fin["insurance_coverage"], remaining)
        plan.append({"source": "insurance_claim", "label": f"Cashless claim — {fin['insurance_policy']}", "amount": claim, "cost": "₹0"})
        remaining -= claim
    if remaining > 0 and usable_savings > 0:
        use = min(usable_savings, remaining)
        plan.append({"source": "savings", "label": "Savings (keeps EMI reserve)", "amount": use, "cost": "₹0"})
        remaining -= use
    if remaining > 0:
        loan = min(fin["preapproved_loan"], remaining)
        plan.append({"source": "preapproved_loan", "label": f"Pre-approved loan @ {fin['loan_rate_pct']}%", "amount": loan,
                     "cost": f"≈{inr(loan * fin['loan_rate_pct'] / 100 / 12)}/month interest"})
        remaining -= loan
    return {
        "requested": amount,
        "purpose": purpose,
        "available": {"savings": fin["savings_balance"], "insurance": fin["insurance_coverage"],
                      "emi": fin["monthly_emi"], "funding_option": fin["preapproved_loan"]},
        "reserve_kept": reserve,
        "plan": plan,
        "covered": amount - max(0, remaining),
        "gap": max(0, remaining),
        "upcoming_obligations": sum(r["amount"] for r in upcoming),
        "needs_loan": any(p["source"] == "preapproved_loan" for p in plan),
        "summary": f"{inr(amount - max(0, remaining))} of {inr(amount)} covered via {', '.join(p['source'] for p in plan)}",
    }


@tool("create_insurance_claim", AGENT, mutates=True)
def create_insurance_claim(user_id: str, amount: float, reason: str) -> dict:
    """Submit an insurance claim (simulated insurer API)."""
    fin = _fin(user_id)
    if amount > fin["insurance_coverage"]:
        raise ToolError(f"claim {inr(amount)} exceeds cover {inr(fin['insurance_coverage'])}")
    claim = {
        "claim_id": store.next_id("CLM"),
        "user_id": user_id,
        "policy_no": fin["insurance_policy_no"],
        "insurer": fin["insurance_policy"],
        "amount": amount,
        "reason": reason,
        "status": "SUBMITTED",
        "submitted_at": now_iso(),
        "simulated": True,
    }
    store.insert("Insurance Claims", claim)
    return {**claim, "summary": f"Claim {claim['claim_id']} SUBMITTED for {inr(amount)}"}
