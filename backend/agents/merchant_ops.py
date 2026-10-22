"""Merchant Operations Agent — cash, inventory, suppliers, customer credit."""
from __future__ import annotations

from backend.agents.base import MERCHANT_USER_ID, AgentResult, Proposal
from backend.services.store import store
from backend.tools.registry import call, ok
from backend.utils.helpers import inr

AGENT = "merchant_ops"


def cash(intent: str, entities: dict) -> AgentResult:
    rec = ok(call("get_cash_records"))
    result = AgentResult(agent=AGENT, intent=intent, user_id=MERCHANT_USER_ID,
                         data=[("Expected cash", inr(rec["expected_cash"])), ("Actual cash", inr(rec["actual_cash"])),
                               ("Variance", inr(rec["variance"]))], facts=rec)
    if rec["status"] == "RECONCILED" or rec["variance"] == 0:
        result.headline, result.decision = "Cash book is balanced", "Nothing to reconcile"
        result.replies = {"en": "Today's cash is already reconciled.", "hi": "Aaj ka cash already reconcile ho chuka hai.",
                          "kn": "Ivattina cash already reconcile aagide."}
        return result
    result.headline = f"Cash difference {inr(rec['variance'])} (expected {inr(rec['expected_cash'])}, counted {inr(rec['actual_cash'])})"
    result.decision = "Record the variance with a reason so the books close correctly"
    result.priority = 2
    result.proposals.append(Proposal(
        action="RECONCILE_CASH",
        description=f"Reconcile today's cash with a {inr(rec['variance'])} variance",
        params={"recon_id": rec["recon_id"], "expected_cash": rec["expected_cash"], "actual_cash": rec["actual_cash"],
                "reason": entities.get("purpose") or "Counted cash short — logged as unexplained variance for review"},
        amount=abs(rec["variance"]), target="Cash book", impact="Closes today's books; variance flagged for review",
        reason=f"Expected {inr(rec['expected_cash'])} = sales − cash expenses; counted {inr(rec['actual_cash'])}"))
    result.replies = {
        "en": f"Cash difference of {inr(abs(rec['variance']))}: expected {inr(rec['expected_cash'])}, counted {inr(rec['actual_cash'])}. Shall I reconcile and log it?",
        "hi": f"Cash mein {inr(abs(rec['variance']))} ka difference hai. Reconcile kar doon?",
        "kn": f"Cash difference {inr(abs(rec['variance']))} ide. Reconcile maadla?",
    }
    return result


def inventory(intent: str, entities: dict) -> AgentResult:
    inv = ok(call("check_inventory", item=entities.get("item")))
    result = AgentResult(agent=AGENT, intent=intent, user_id=MERCHANT_USER_ID, facts=inv)
    if not inv["low_stock"]:
        result.headline, result.decision = "All stock above minimum", "No reorder needed"
        result.replies = {"en": "All items are above minimum stock.", "hi": "Sab items minimum stock se upar hain.",
                          "kn": "Ella items minimum stock-ginta jaasti ide."}
        return result
    critical = sorted(inv["low_stock"], key=lambda i: i["days_left"])
    for item in critical[:2]:
        plan = ok(call("calculate_reorder", sku=item["sku"]))
        result.data += [(f"{item['item']} stock", f"{item['stock']:g} {item['unit']}"), ("Minimum", f"{item['min_stock']:g} {item['unit']}"),
                        ("Recommended", f"{plan['recommended_qty']:g} {item['unit']}"), ("Cost", inr(plan["estimated_cost"]))]
        result.proposals.append(Proposal(
            action="CREATE_PURCHASE_ORDER",
            description=f"Order {plan['recommended_qty']:g} {plan['unit']} {plan['item']} from {plan['supplier']}",
            params={"sku": plan["sku"], "quantity": plan["recommended_qty"], "supplier_id": plan["supplier_id"]},
            amount=plan["estimated_cost"], target=plan["supplier"],
            impact=f"Avoids a stock-out in ~{item['days_left']} day(s)", reason=plan["summary"]))
    top = critical[0]
    plan0 = result.proposals[0]
    result.headline = f"{top['item']} {top['level']}: {top['stock']:g} {top['unit']} left (min {top['min_stock']:g}) — ~{top['days_left']} days"
    result.decision = f"Reorder {plan0.params['quantity']:g} {top['unit']} (shortfall + lead-time usage, rounded to supplier pack)"
    result.priority = 3 if top["level"] == "CRITICAL" else 2
    result.replies = {
        "en": f"{top['item']} is critical: {top['stock']:g} {top['unit']} left against a minimum of {top['min_stock']:g}. "
              f"I recommend ordering {plan0.params['quantity']:g} {top['unit']} for about {inr(plan0.amount)}. Shall I send the purchase order?",
        "hi": f"Rice stock critical hai — sirf {top['stock']:g} {top['unit']} bacha hai. {plan0.params['quantity']:g} {top['unit']} order karoon ({inr(plan0.amount)})?",
        "kn": f"Rice stock critical ide — {top['stock']:g} {top['unit']} maatra ide. {plan0.params['quantity']:g} {top['unit']} order maadla? Cost {inr(plan0.amount)}.",
    }
    return result


def reminder(intent: str, entities: dict) -> AgentResult:
    name = (entities.get("customer_name") or "").strip()
    credit = ok(call("get_customer_credit"))
    customers = credit["customers"]
    target = next((c for c in customers if name and c["name"].lower() == name.lower()), None)
    if target is None:
        overdue = sorted(credit["overdue"], key=lambda c: -c["overdue_days"])
        target = overdue[0] if overdue else None
    result = AgentResult(agent=AGENT, intent=intent, user_id=MERCHANT_USER_ID, facts=credit,
                         data=[("Total outstanding", inr(credit["total_outstanding"]))])
    if not target:
        result.headline = "No overdue customers"
        result.replies = {"en": "No customer payments are overdue."}
        return result
    message = (f"Namaskara {target['name']} avare 🙏\nLakshmi General Stores nalli nimma {inr(target['outstanding'])} baaki ide "
               f"({target['overdue_days']} dina overdue). Dayavittu sigtaane UPI athava cash moolaka paavati maadi.\n\n"
               f"Hello {target['name']}, a gentle reminder that {inr(target['outstanding'])} is pending at Lakshmi General Stores. Thank you!")
    result.data += [("Customer", target["name"]), ("Outstanding", inr(target["outstanding"])), ("Overdue", f"{target['overdue_days']} days")]
    result.headline = f"{target['name']} owes {inr(target['outstanding'])}, {target['overdue_days']} days overdue"
    result.decision = "Send a polite bilingual reminder on Telegram"
    result.priority = 2
    result.proposals.append(Proposal(
        action="SEND_PAYMENT_REMINDER", description=f"Send payment reminder to {target['name']} for {inr(target['outstanding'])}",
        params={"customer_id": target["customer_id"], "message": message}, amount=target["outstanding"], target=target["name"],
        impact=f"Recover {inr(target['outstanding'])} receivable", reason=f"{target['overdue_days']} days overdue"))
    result.replies = {
        "en": f"{target['name']} owes {inr(target['outstanding'])}, {target['overdue_days']} days overdue. I've drafted a polite reminder — send it on Telegram?",
        "hi": f"{target['name']} ka {inr(target['outstanding'])} baaki hai ({target['overdue_days']} din overdue). Reminder bhej doon?",
        "kn": f"{target['name']} avaru {inr(target['outstanding'])} kodbeku ({target['overdue_days']} dina overdue). Polite reminder kalisla?",
    }
    return result


def handle(intent: str, entities: dict, user_id: str) -> AgentResult:
    if intent == "cash_reconcile":
        return cash(intent, entities)
    if intent == "customer_reminder":
        return reminder(intent, entities)
    return inventory(intent, entities)


def low_stock_count() -> int:
    return sum(1 for i in store.all("Inventory") if i["stock"] < i["min_stock"])
