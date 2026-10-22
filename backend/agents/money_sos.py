"""Money SOS Agent — urgent needs, solved safely (insurance → savings → credit)."""
from __future__ import annotations

from backend.agents.base import AgentResult, Proposal
from backend.tools.registry import call, ok
from backend.utils.helpers import inr

AGENT = "money_sos"
MEDICAL = {"medical", "hospital", "health", "surgery", "accident", "doctor"}


def handle(intent: str, entities: dict, user_id: str) -> AgentResult:
    summary = ok(call("get_financial_summary", user_id=user_id))
    insurance = ok(call("get_insurance_details", user_id=user_id))
    upcoming = ok(call("get_upcoming_payments", user_id=user_id, within_days=30))
    amount = entities.get("amount")
    purpose = (entities.get("purpose") or "").lower()
    purpose = "medical" if any(word in purpose for word in MEDICAL) else purpose or "unknown"
    data = [("Savings", inr(summary["savings_balance"])), ("Insurance coverage", inr(insurance["coverage"])),
            ("Upcoming EMI", inr(summary["monthly_emi"])), ("Available financing", inr(summary["preapproved_loan"]))]

    if intent == "financial_summary" or not amount:
        return AgentResult(
            agent=AGENT, intent=intent, user_id=user_id, data=data,
            headline=f"Savings {inr(summary['savings_balance'])}, balance {inr(summary['current_balance'])}, {len(upcoming['payments'])} payments due",
            decision="Summarise position", facts={"summary": summary, "upcoming": upcoming},
            replies={"en": f"You have {inr(summary['savings_balance'])} in savings and {inr(summary['current_balance'])} in your account. "
                           f"{len(upcoming['payments'])} payments worth {inr(upcoming['total'])} are due this month; salary of {inr(summary['monthly_income'])} lands on {summary['salary_date']}.",
                     "hi": f"Aapke savings mein {inr(summary['savings_balance'])} aur account mein {inr(summary['current_balance'])} hai. Is mahine {inr(upcoming['total'])} ke payments due hain.",
                     "kn": f"Nimma savings {inr(summary['savings_balance'])}, account balance {inr(summary['current_balance'])}. Ee tingalu {inr(upcoming['total'])} payments due ide."})

    options = ok(call("find_funding_options", user_id=user_id, amount=amount, purpose=purpose))
    result = AgentResult(agent=AGENT, intent=intent, user_id=user_id, data=data + [("Requested", inr(amount))],
                         facts={"options": options, "insurance": insurance}, priority=3)
    if purpose == "unknown":
        result.headline = f"Need {inr(amount)} — purpose unclear; insurance could cover {inr(insurance['coverage'])} if medical"
        result.decision = "Ask whether it is a medical emergency before choosing the plan"
        result.replies = {
            "en": f"I can help you arrange {inr(amount)}. You have {inr(summary['savings_balance'])} savings, a {inr(summary['preapproved_loan'])} pre-approved loan, "
                  f"and health insurance worth {inr(insurance['coverage'])}. Is this for a medical emergency? If yes, insurance can cover most of it with no loan.",
            "hi": f"Main {inr(amount)} arrange karne mein madad kar sakta hoon. Kya yeh medical emergency hai? Agar haan, toh insurance {inr(insurance['coverage'])} tak cover karega.",
            "kn": f"{inr(amount)} arrange maadakke sahaya maadtini. Idu medical emergency-na? Haudu andre insurance {inr(insurance['coverage'])} varege cover maadutte.",
        }
        return result

    plan_text = " + ".join(f"{p['label']} {inr(p['amount'])}" for p in options["plan"])
    result.headline = f"{inr(options['covered'])} of {inr(amount)} covered: {plan_text}"
    result.findings = [f"Keeps at least {inr(options['reserve_kept'])} in savings for your {inr(summary['monthly_emi'])} EMI",
                       "No loan needed" if not options["needs_loan"] else "Loan needed for the remainder"]
    result.decision = "Insurance first, then savings above the EMI reserve, credit only as last resort"
    claim = next((p for p in options["plan"] if p["source"] == "insurance_claim"), None)
    if claim:
        result.proposals.append(Proposal(
            action="CREATE_INSURANCE_CLAIM",
            description=f"File cashless insurance claim for {inr(claim['amount'])} ({insurance['policy']})",
            params={"user_id": user_id, "amount": claim["amount"], "reason": "Hospital admission — emergency"},
            amount=claim["amount"], target=insurance["policy"],
            impact=f"Covers {inr(claim['amount'])} at zero cost; avoids a {inr(summary['preapproved_loan'])} loan",
            reason=plan_text))
    savings = next((p["amount"] for p in options["plan"] if p["source"] == "savings"), 0)
    left = summary["savings_balance"] - savings
    result.replies = {
        "en": f"Here's a safe plan for {inr(amount)}: file a cashless insurance claim for {inr(claim['amount'] if claim else 0)} and use {inr(savings)} from savings. "
              f"You still keep {inr(left)} in savings for your {inr(summary['monthly_emi'])} EMI, and need no loan. Shall I file the claim now?",
        "hi": f"{inr(amount)} ke liye safe plan: {inr(claim['amount'] if claim else 0)} ka insurance claim aur {inr(savings)} savings se. EMI ke liye {inr(left)} bacha rahega, loan ki zaroorat nahi. Claim file karoon?",
        "kn": f"{inr(amount)} ge safe plan: {inr(claim['amount'] if claim else 0)} insurance claim mattu savings-inda {inr(savings)}. EMI ge {inr(left)} uLiyutte, loan beda. Claim file maadla?",
    }
    return result
