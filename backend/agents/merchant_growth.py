"""Merchant Growth Agent — detect → reason → create → approve → execute → measure."""
from __future__ import annotations

from backend.agents.base import MERCHANT_USER_ID, AgentResult, Proposal
from backend.services.store import store
from backend.tools.registry import call, ok
from backend.utils.helpers import inr

AGENT = "merchant_growth"


def business_health(intent: str, entities: dict) -> AgentResult:
    sales = ok(call("get_sales_summary"))
    expenses = ok(call("get_expenses"))
    cash = ok(call("get_cash_records"))
    stock = ok(call("check_inventory"))
    credit = ok(call("get_customer_credit"))
    trend = ok(call("analyze_sales"))
    churn = ok(call("identify_customer_churn"))
    health = ok(call("calculate_business_health"))
    evening = trend["slots"]["evening"]
    findings = []
    for item in stock["low_stock"]:
        findings.append({"title": f"{item['item']} {item['level'].lower()} stock", "urgency": 3 if item["level"] == "CRITICAL" else 2,
                         "impact": round(item["daily_usage"] * item["sell_price"] * 3), "why": f"Runs out in ~{item['days_left']} day(s)",
                         "action": f"Order {item['item'].split()[-1].lower()}", "intent": "inventory_check"})
    if evening["change_pct"] <= -10:
        findings.append({"title": f"Evening sales {evening['change_pct']:+.0f}%", "urgency": 2,
                         "impact": (evening["prev_7d_avg"] - evening["last_7d_avg"]) * 7,
                         "why": f"{inr(evening['prev_7d_avg'] - evening['last_7d_avg'])}/day lost; regulars {churn['change_pct']:+.0f}%",
                         "action": "Launch evening promotion", "intent": "growth_campaign"})
    overdue = sum(c["outstanding"] for c in credit["overdue"])
    if overdue:
        findings.append({"title": f"{inr(overdue)} customer credit overdue", "urgency": 1, "impact": overdue,
                         "why": f"{len(credit['overdue'])} customers overdue", "action": "Send reminders", "intent": "customer_reminder"})
    if cash["variance"] and cash["status"] != "RECONCILED":
        findings.append({"title": f"Cash variance {inr(cash['variance'])}", "urgency": 1, "impact": abs(cash["variance"]),
                         "why": "Counted cash below expected", "action": "Reconcile cash", "intent": "cash_reconcile"})
    ranked = ok(call("generate_next_best_action", findings=findings))["ranked"]
    opportunity = next((f for f in ranked if f["intent"] == "growth_campaign"), None)
    urgent = ranked[0] if ranked else None
    result = AgentResult(
        agent=AGENT, intent=intent, user_id=MERCHANT_USER_ID, priority=2,
        headline=f"Sales {inr(sales['today'])} ({sales['growth_pct']:+.1f}%), health {health['score']}/100 — "
                 f"most urgent: {urgent['title'] if urgent else 'none'}; biggest opportunity: {opportunity['title'] if opportunity else 'none'}",
        findings=[f"{f['title']} — {f['why']}" for f in ranked],
        data=[("Sales", f"{inr(sales['today'])} (prev {inr(sales['yesterday'])})"), ("Growth", f"{sales['growth_pct']:+.1f}%"),
              ("Expenses", inr(expenses["total"])), ("Expected cash", inr(cash["expected_cash"])), ("Actual cash", inr(cash["actual_cash"])),
              ("Cash variance", inr(cash["variance"])), ("Rice", "LOW STOCK" if any("Rice" in i["item"] for i in stock["low_stock"]) else "OK"),
              ("Customer credit", inr(credit["total_outstanding"])), ("Evening sales", f"{evening['change_pct']:+.0f}%"),
              ("Health score", f"{health['score']}/100")],
        decision="Prioritise: what matters most + why + what to do (not a data dump)",
        facts={"sales": sales, "expenses": expenses["total"], "cash": cash, "health": health, "ranked": ranked,
               "evening": evening, "churn": churn, "credit_total": credit["total_outstanding"]},
    )
    result.facts["suggested_actions"] = [{"label": f["action"], "intent": f["intent"]} for f in ranked[:3]]
    result.replies = {
        "en": f"Today's sales are {inr(sales['today'])}, up {sales['growth_pct']:.1f}%. But evening sales have dropped {abs(evening['change_pct']):.0f}% — "
              f"that's your biggest opportunity — and rice stock is at a critical level. Shall I order rice first, then plan an evening offer?",
        "hi": f"Aaj sales {inr(sales['today'])} hai, {sales['growth_pct']:.1f}% upar. Lekin evening sales {abs(evening['change_pct']):.0f}% kam hui hai, aur rice stock critical hai. Pehle rice order karoon?",
        "kn": f"Nimma sales ivattu {sales['growth_pct']:.1f}% increase aagide. Aadare evening sales {abs(evening['change_pct']):.0f}% decrease aagide. "
              "Rice stock kooda critical level alli ide. Modalu rice order maadla, aamele evening offer plan maadona?",
    }
    return result


def growth(intent: str, entities: dict) -> AgentResult:
    trend = ok(call("analyze_sales"))
    churn = ok(call("identify_customer_churn"))
    opp = ok(call("identify_growth_opportunity"))
    if not opp.get("opportunity"):
        return AgentResult(agent=AGENT, intent=intent, user_id=MERCHANT_USER_ID, headline="No decline detected",
                           replies={"en": "Sales are stable across all time slots — no campaign needed right now."})
    campaign = ok(call("generate_campaign", opportunity=opp["opportunity"]))
    live = campaign["status"] == "LIVE"
    result = AgentResult(
        agent=AGENT, intent=intent, user_id=MERCHANT_USER_ID, priority=2,
        headline=f"Evening sales {opp['change_pct']:+.0f}%, regulars {churn['change_pct']:+.0f}% → {campaign['name']} {inr(campaign['price'])}, {campaign['window']}",
        findings=[f"Problem: {opp['problem']}", f"Opportunity: {opp['idea']}", f"{inr(opp['revenue_at_stake_per_day'])}/day at stake"],
        data=[("Evening sales", f"{opp['change_pct']:+.0f}%"), ("Regular customers", f"{churn['change_pct']:+.0f}%"),
              ("Revenue at stake", f"{inr(opp['revenue_at_stake_per_day'])}/day"), ("Offer", f"{campaign['name']} · {inr(campaign['price'])}"),
              ("Window", campaign["window"])],
        decision="Create an evening promotion targeted at lapsed regulars",
        facts={"opportunity": opp, "campaign": campaign, "trend": trend},
    )
    if not live:
        result.proposals.append(Proposal(
            action="PUBLISH_CAMPAIGN", description=f"Create & publish '{campaign['name']}' — {inr(campaign['price'])}, {campaign['window']}",
            params={"campaign_id": campaign["campaign_id"]}, target="Customer broadcast (Telegram)",
            impact=f"Target: recover {inr(opp['revenue_at_stake_per_day'])}/day of evening sales",
            reason=f"Evening sales {opp['change_pct']:+.0f}% while regulars {churn['change_pct']:+.0f}%"))
    result.replies = {
        "en": f"Your evening sales have fallen {abs(opp['change_pct']):.0f}%, and regular customers are down {abs(churn['change_pct']):.0f}%. "
              f"I recommend an {campaign['name']} for {inr(campaign['price'])}, {campaign['window']}. Would you like me to create and publish it?",
        "hi": f"Evening sales {abs(opp['change_pct']):.0f}% gir gayi hai. Main {campaign['name']} {inr(campaign['price'])} mein, {campaign['window']} suggest karta hoon. Publish karoon?",
        "kn": f"Evening sales {abs(opp['change_pct']):.0f}% kammi aagide. {campaign['window']} {campaign['name']} {inr(campaign['price'])}-ge suggest maadtini. Create maadi publish maadla?",
    }
    return result


def campaign_roi(intent: str, entities: dict) -> AgentResult:
    live = [c for c in store.all("Campaigns") if c["status"] == "LIVE"]
    if not live:
        return AgentResult(agent=AGENT, intent=intent, user_id=MERCHANT_USER_ID, headline="No live campaign",
                           replies={"en": "There's no live campaign to measure yet."})
    roi = ok(call("calculate_campaign_roi", campaign_id=live[-1]["campaign_id"]))
    return AgentResult(agent=AGENT, intent=intent, user_id=MERCHANT_USER_ID, headline=roi["summary"],
                       data=[("Before", f"{inr(roi['before_daily'])}/day"), ("After", f"{inr(roi['after_daily'])}/day"),
                             ("Improvement", f"{roi['improvement_pct']:+.1f}%")], facts=roi,
                       replies={"en": f"The {roi['name']} lifted evening sales from {inr(roi['before_daily'])} to {inr(roi['after_daily'])} a day — {roi['improvement_pct']:+.1f}% (simulated)."})


def handle(intent: str, entities: dict, user_id: str) -> AgentResult:
    if intent == "business_health":
        return business_health(intent, entities)
    if intent == "campaign_roi":
        return campaign_roi(intent, entities)
    return growth(intent, entities)
