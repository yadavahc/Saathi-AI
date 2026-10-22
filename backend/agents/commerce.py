"""Commerce Agent — natural-language purchasing."""
from __future__ import annotations

from backend.agents.base import AgentResult, Proposal
from backend.tools.registry import call, ok
from backend.utils.helpers import inr

AGENT = "commerce"


def handle(intent: str, entities: dict, user_id: str, text: str = "") -> AgentResult:
    parsed = ok(call("parse_purchase_intent", text=text, items=entities.get("items") or None,
                     budget=entities.get("budget"), deadline=entities.get("deadline")))
    found = ok(call("find_merchants", items=parsed["items"]))
    ids = [m["merchant_id"] for m in found["merchants"]]
    for mid in ids:
        call("check_availability", merchant_id=mid, items=parsed["items"])
    compare = ok(call("compare_prices", items=parsed["items"], merchant_ids=ids, budget=parsed["budget"], deadline=parsed["deadline"]))
    best = compare["best"]
    result = AgentResult(
        agent=AGENT, intent=intent, user_id=user_id, priority=1,
        data=[("Items", parsed["summary"]), ("Deadline", parsed["deadline"])] +
             [(q["name"], f"{inr(q['total'])} · {q['delivery']}" + ("" if q["eligible"] else f" ✗ {q['rejected_reason']}")) for q in compare["quotes"]],
        facts={"intent": parsed, "quotes": compare["quotes"], "best": best},
    )
    if not best:
        result.headline = "No merchant meets the budget and deadline"
        result.replies = {"en": "I couldn't find a merchant who can deliver everything within your budget and deadline. Want me to relax the deadline?"}
        return result
    result.headline = f"Best: {best['name']} {inr(best['total'])}, {best['delivery']}"
    result.findings = [f"{len(compare['quotes'])} merchants compared", f"Saves {inr(compare['savings_vs_next'])} vs next option"] + \
                      [f"{q['name']} excluded: {q['rejected_reason']}" for q in compare["quotes"] if not q["eligible"]]
    result.decision = "Cheapest vendor that has stock and meets the deadline and budget"
    result.proposals.append(Proposal(
        action="PLACE_ORDER", description=f"Order {parsed['summary']} from {best['name']} for {inr(best['total'])}",
        params={"merchant_id": best["merchant_id"], "items": parsed["items"], "total": best["total"], "delivery": best["delivery"]},
        amount=best["total"], target=best["name"], impact=f"Delivery {best['delivery']}, within budget",
        reason=result.decision))
    result.replies = {
        "en": f"I found {len(compare['quotes'])} merchants. {best['name']} can deliver {best['delivery']} for {inr(best['total'])}, "
              f"{inr(compare['savings_vs_next'])} cheaper than the next option. Shall I place the order?",
        "hi": f"{best['name']} {best['delivery']} {inr(best['total'])} mein deliver karega. Order karoon?",
        "kn": f"{best['name']} {best['delivery']} {inr(best['total'])}-ge deliver maadtare. Order maadla?",
    }
    return result
