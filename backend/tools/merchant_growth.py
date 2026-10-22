"""Merchant Growth Agent tools — find and act on revenue opportunities."""
from __future__ import annotations

from statistics import mean

from backend.integrations.telegram import telegram
from backend.services.store import store
from backend.tools.registry import ToolError, tool
from backend.utils.helpers import inr, now_iso

AGENT = "merchant_growth"
MERCHANT = "MER-001"


def _weeks(merchant_id: str) -> tuple[list[dict], list[dict]]:
    rows = sorted(store.all("Sales", merchant_id=merchant_id), key=lambda r: r["days_ago"])
    return rows[:7], rows[7:14]


@tool("analyze_sales", AGENT)
def analyze_sales(merchant_id: str = MERCHANT) -> dict:
    """Week-over-week change per time slot."""
    last, prev = _weeks(merchant_id)
    if len(prev) < 7:
        raise ToolError("need two weeks of sales")
    slots = {}
    for slot in ("morning", "afternoon", "evening", "total"):
        a, b = mean(r[slot] for r in last), mean(r[slot] for r in prev)
        slots[slot] = {"last_7d_avg": round(a), "prev_7d_avg": round(b), "change_pct": round((a - b) / b * 100, 1)}
    worst = min(("morning", "afternoon", "evening"), key=lambda s: slots[s]["change_pct"])
    return {"slots": slots, "weakest_slot": worst,
            "summary": f"{worst.title()} sales {slots[worst]['change_pct']:+.1f}% week-over-week"}


@tool("identify_customer_churn", AGENT)
def identify_customer_churn(merchant_id: str = MERCHANT) -> dict:
    """Change in regular customers week-over-week."""
    last, prev = _weeks(merchant_id)
    a, b = mean(r["regular_customers"] for r in last), mean(r["regular_customers"] for r in prev)
    change = (a - b) / b * 100
    return {"regular_customers_last_7d": round(a), "regular_customers_prev_7d": round(b), "change_pct": round(change, 1),
            "at_risk_customers": round(b - a), "summary": f"Regular customers {change:+.1f}%"}


@tool("identify_growth_opportunity", AGENT)
def identify_growth_opportunity(merchant_id: str = MERCHANT) -> dict:
    """Turns the sales + churn signal into a concrete opportunity with revenue at stake."""
    last, prev = _weeks(merchant_id)
    a, b = mean(r["evening"] for r in last), mean(r["evening"] for r in prev)
    change = (a - b) / b * 100
    if change > -10:
        return {"opportunity": None, "summary": "No significant decline detected"}
    return {
        "opportunity": "evening_footfall",
        "problem": "Evening customer activity is declining",
        "slot": "4 PM – 7 PM",
        "change_pct": round(change, 1),
        "revenue_at_stake_per_day": round(b - a),
        "top_evening_items": ["Tea", "Samosa", "Biscuits", "Banana chips"],
        "idea": "Evening Tea + Snack Combo to bring regulars back",
        "summary": f"Evening sales {change:+.1f}% · {inr(b - a)}/day at stake",
    }


@tool("generate_campaign", AGENT, mutates=True)
def generate_campaign(merchant_id: str = MERCHANT, opportunity: str = "evening_footfall") -> dict:
    """Creates a campaign draft (price maths done here, not by the LLM)."""
    if opportunity != "evening_footfall":
        raise ToolError(f"no template for {opportunity}")
    tea, snack = 15, 40
    combo = 50
    existing = next((c for c in store.all("Campaigns", merchant_id=merchant_id) if c["status"] in {"DRAFT", "LIVE"} and c.get("opportunity") == opportunity), None)
    if existing:
        return {**existing, "summary": f"{existing['campaign_id']} already {existing['status']}"}
    last, _ = _weeks(merchant_id)
    campaign = {
        "campaign_id": store.next_id("CMP"),
        "merchant_id": merchant_id,
        "opportunity": opportunity,
        "name": "Evening Tea + Snack Combo",
        "offer": f"Tea + Samosa/Snack for {inr(combo)} (save {inr(tea + snack - combo)})",
        "price": combo,
        "regular_price": tea + snack,
        "window": "4 PM – 7 PM",
        "channel": "telegram",
        "message": ("☕ Lakshmi General Stores — Evening Combo!\nTea + Snack only ₹50 (save ₹5) · 4–7 PM daily.\n"
                    "Sanje 4–7 Tea + Snack combo kevala ₹50! Banni 🙏"),
        "status": "DRAFT",
        "before_daily": round(mean(r["evening"] for r in last)),
        "after_daily": None,
        "improvement_pct": None,
        "created_at": now_iso(),
        "simulated": True,
    }
    store.insert("Campaigns", campaign)
    return {**campaign, "summary": f"Draft {campaign['campaign_id']}: {campaign['name']} {inr(combo)}"}


@tool("send_campaign", AGENT, mutates=True)
def send_campaign(campaign_id: str) -> dict:
    """Publish the campaign to the customer broadcast channel."""
    campaign = store.get("Campaigns", campaign_id)
    if not campaign:
        raise ToolError(f"{campaign_id} not found")
    if campaign["status"] == "LIVE":
        return {**campaign, "summary": "already live"}
    message = telegram.send(role="customer", title=f"Campaign · {campaign['name']}", text=campaign["message"], related_id=campaign_id)
    updated = store.update("Campaigns", campaign_id, {"status": "LIVE", "published_at": now_iso(), "delivered": message["will_deliver"]})
    return {**updated, "summary": f"{campaign_id} LIVE" + (" on Telegram" if message["will_deliver"] else " (dashboard outbox)")}


@tool("calculate_campaign_roi", AGENT, mutates=True)
def calculate_campaign_roi(campaign_id: str) -> dict:
    """Measures before vs after. Post-campaign sales are SIMULATED in the sandbox."""
    campaign = store.get("Campaigns", campaign_id)
    if not campaign:
        raise ToolError(f"{campaign_id} not found")
    if campaign["status"] not in {"LIVE", "COMPLETED"}:
        raise ToolError("campaign is not live yet")
    before = 8200
    after = 11700
    combos_per_day = 120
    discount_cost = combos_per_day * (campaign["regular_price"] - campaign["price"])
    incremental = after - before
    margin = 0.25
    roi = (incremental * margin - discount_cost) / discount_cost * 100
    improvement = (after - before) / before * 100
    updated = store.update("Campaigns", campaign_id, {"before_daily": before, "after_daily": after,
                                                      "improvement_pct": round(improvement, 1), "roi_pct": round(roi, 1), "measured_at": now_iso()})
    return {**updated, "incremental_revenue_per_day": incremental, "discount_cost_per_day": discount_cost, "simulated": True,
            "summary": f"{inr(before)}/day → {inr(after)}/day ({improvement:+.1f}%)"}


@tool("calculate_business_health", AGENT)
def calculate_business_health(merchant_id: str = MERCHANT) -> dict:
    """Composite 0–100 health score from growth, cash, stock, credit and slot trends."""
    rows = sorted(store.all("Sales", merchant_id=merchant_id), key=lambda r: r["days_ago"])
    growth = (rows[0]["total"] - rows[1]["total"]) / rows[1]["total"] * 100
    last, prev = rows[:7], rows[7:14]
    evening = (mean(r["evening"] for r in last) - mean(r["evening"] for r in prev)) / mean(r["evening"] for r in prev) * 100
    low = [i for i in store.all("Inventory", merchant_id=merchant_id) if i["stock"] < i["min_stock"]]
    overdue = sum(c["outstanding"] for c in store.all("Customer Credit", merchant_id=merchant_id) if c["overdue_days"] > 0)
    recon = next((r for r in store.all("Cash Reconciliation", merchant_id=merchant_id) if r["days_ago"] == 0), None)
    score = 70 + min(15, growth / 2) + max(-15, evening / 2) - 6 * len(low) - min(8, overdue / 1000) - (3 if recon and recon["status"] != "RECONCILED" else 0)
    score = max(0, min(100, round(score)))
    return {"score": score, "grade": "GOOD" if score >= 75 else "FAIR" if score >= 55 else "AT RISK",
            "drivers": {"sales_growth_pct": round(growth, 1), "evening_change_pct": round(evening, 1), "low_stock_items": len(low),
                        "overdue_credit": overdue}, "summary": f"Business health {score}/100"}


@tool("generate_next_best_action", AGENT)
def generate_next_best_action(findings: list[dict]) -> dict:
    """Ranks findings by urgency × rupee impact — what matters most, why, what to do."""
    def rank(f: dict) -> float:
        return f.get("urgency", 1) * 10000 + f.get("impact", 0)

    ordered = sorted(findings, key=rank, reverse=True)
    return {"ranked": ordered, "top": ordered[0] if ordered else None,
            "summary": f"Top: {ordered[0]['title']}" if ordered else "Nothing urgent"}
