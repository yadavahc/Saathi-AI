"""Financial Radar + dashboard aggregation (pure reads — no tool logging on every poll)."""
from __future__ import annotations

from statistics import mean

from backend.agents.base import AGENT_INFO
from backend.integrations.claude_client import claude
from backend.integrations.sarvam import sarvam
from backend.integrations.sheets import sheets
from backend.integrations.telegram import telegram
from backend.integrations.vobiz import vobiz
from backend.services import approvals, audit, calls, flow, scam_shield
from backend.services.store import store
from backend.tools.payment_reliability import failure_probability
from backend.tools.registry import TOOLS
from backend.utils.helpers import clock12, inr

LEVEL_ORDER = {"HIGH": 0, "MEDIUM": 1, "WATCH": 2, "HEALTHY": 3}


def financial_radar(user_id: str = "U001") -> list[dict]:
    items: list[dict] = []
    fin = store.get("Financial Data", user_id)
    for txn in store.all("Transactions", user_id=user_id):
        if txn["status"] in {"PENDING", "FLAGGED"} and (txn.get("risk_score") or 0) >= 75:
            items.append({"id": f"fraud-{txn['txn_id']}", "level": "HIGH", "category": "Fraud",
                          "title": f"{inr(txn['amount'])} suspicious payment", "subtitle": f"{clock12(txn['time'])} · new recipient",
                          "found": f"{inr(txn['amount'])} to {txn['recipient']} at {txn['time']}, risk {txn['risk_score']}/100",
                          "why": "Up to the full amount could be lost to a scam.",
                          "recommend": "Verify by voice, then block and register a complaint.",
                          "action": {"label": "Review in Live Call", "view": "calls", "prompt": "Block the suspicious payment and report fraud"}})
    for rp in store.all("Recurring Payments", user_id=user_id):
        if rp["status"] != "ACTIVE" or rp["due_in_days"] > 15:
            continue
        topup = sum(p["transfer_amount"] for p in store.all("Payment Plans", rp_id=rp["rp_id"]) if p["status"] == "ACTIVE")
        income = fin["monthly_income"] if fin["salary_in_days"] <= rp["due_in_days"] else 0
        projected = fin["current_balance"] + income + topup
        p = failure_probability(projected, rp["amount"], rp["past_failures"])
        if p >= 0.6:
            items.append({"id": f"pay-{rp['rp_id']}", "level": "HIGH", "category": "Payment",
                          "title": f"{inr(rp['amount'])} recurring payment", "subtitle": f"{round(p * 100)}% failure probability · due in {rp['due_in_days']} days",
                          "found": f"{rp['name']} via {rp['mandate']}; expected balance {inr(projected)}",
                          "why": f"Shortfall of {inr(rp['amount'] - projected)} → mandate failure, bounce charges, service cut.",
                          "recommend": "Sweep money from savings the day before the debit.",
                          "action": {"label": "Create payment plan", "prompt": "Will my upcoming AutoPay payments go through?", "persona": "consumer"}})
        elif topup:
            items.append({"id": f"pay-{rp['rp_id']}", "level": "HEALTHY", "category": "Payment", "title": f"{inr(rp['amount'])} payment protected",
                          "subtitle": f"Payment plan active · risk {round(p * 100)}%", "found": f"{inr(topup)} sweep scheduled",
                          "why": "Balance now covers the debit.", "recommend": "No action needed.", "action": None})
        elif rp["category"] == "insurance":
            items.append({"id": f"pay-{rp['rp_id']}", "level": "WATCH", "category": "Insurance", "title": "Insurance premium",
                          "subtitle": f"Due in {rp['due_in_days']} days · {inr(rp['amount'])}", "found": f"{rp['name']} via {rp['mandate']}",
                          "why": "Missing it can lapse your health cover.", "recommend": "Keep the balance above the premium on the due date.",
                          "action": None})
    for c in store.all("Customer Credit"):
        if c["overdue_days"] > 5 and c.get("reminder_status") != "REMINDER SENT":
            items.append({"id": f"credit-{c['customer_id']}", "level": "MEDIUM", "category": "Receivable",
                          "title": f"{inr(c['outstanding'])} receivable", "subtitle": f"{c['name']} · {c['overdue_days']} days overdue",
                          "found": f"{c['name']} owes {inr(c['outstanding'])}", "why": "Older dues get harder to recover; ties up working capital.",
                          "recommend": "Send a polite reminder on Telegram.",
                          "action": {"label": "Send reminder", "prompt": f"{c['name']} ge payment reminder kalisu", "persona": "merchant"}})
    for item in store.all("Inventory"):
        if item["stock"] < item["min_stock"] * 0.5 and not item.get("incoming"):
            items.append({"id": f"stock-{item['sku']}", "level": "MEDIUM", "category": "Inventory", "title": f"{item['item']} critical",
                          "subtitle": f"{item['stock']:g} {item['unit']} left · min {item['min_stock']:g}",
                          "found": f"~{item['stock'] / item['daily_usage']:.1f} days of stock", "why": "Stock-outs lose sales and regular customers.",
                          "recommend": "Reorder from your supplier.",
                          "action": {"label": "Reorder", "prompt": "Rice stock check maadi", "persona": "merchant"}})
    items.append({"id": "income", "level": "HEALTHY", "category": "Income", "title": "Expected income",
                  "subtitle": f"{inr(fin['monthly_income'])} salary in {fin['salary_in_days']} days", "found": f"Salary credit on {fin['salary_date']}",
                  "why": "Covers EMI and next month's obligations.", "recommend": "No action needed.", "action": None})
    return sorted(items, key=lambda i: LEVEL_ORDER[i["level"]])


def integrations() -> dict:
    return {
        "claude": {"status": claude.status, "detail": claude.detail, "latency_ms": claude.last_latency_ms},
        "sarvam": {"status": sarvam.status, "detail": sarvam.detail},
        "vobiz": {"status": vobiz.status, "detail": vobiz.detail},
        "telegram": {"status": telegram.status, "detail": telegram.detail, "bot": telegram.bot_username},
        "sheets": {"status": sheets.status, "detail": sheets.detail},
    }


def agents_status() -> list[dict]:
    logs = store.all("Activity Logs")
    out = []
    for key, info in AGENT_INFO.items():
        mine = [l for l in logs if l["agent"] == key]
        out.append({"id": key, **info, "tool_calls": sum(1 for l in mine if l["kind"].startswith("tool")),
                    "actions": sum(1 for l in mine if l["kind"] == "action"),
                    "last_active": mine[-1]["timestamp"] if mine else None,
                    "active": bool(mine) and any(r["status"] in {"RUNNING", "AWAITING_APPROVAL"} and key in (r.get("agents") or [])
                                                 for r in store.all("Agent Runs")[-3:])})
    return out


def sales_view() -> dict:
    rows = sorted(store.all("Sales", merchant_id="MER-001"), key=lambda r: -r["days_ago"])
    last, prev = rows[-7:], rows[-14:-7]
    today_row, yesterday = rows[-1], rows[-2]
    return {"series": [{"date": r["date"][5:], "total": r["total"], "evening": r["evening"], "morning": r["morning"],
                        "afternoon": r["afternoon"], "customers": r["regular_customers"]} for r in rows],
            "today": today_row["total"], "yesterday": yesterday["total"],
            "growth_pct": round((today_row["total"] - yesterday["total"]) / yesterday["total"] * 100, 1),
            "evening_change_pct": round((mean(r["evening"] for r in last) - mean(r["evening"] for r in prev)) / mean(r["evening"] for r in prev) * 100, 1),
            "customers_change_pct": round((mean(r["regular_customers"] for r in last) - mean(r["regular_customers"] for r in prev)) / mean(r["regular_customers"] for r in prev) * 100, 1)}


def dashboard() -> dict:
    radar = financial_radar()
    logs = store.all("Activity Logs")
    txns = store.all("Transactions")
    cash = next((r for r in store.all("Cash Reconciliation") if r["days_ago"] == 0), {})
    sales = sales_view()
    expenses_today = sum(e["amount"] for e in store.all("Expenses") if e["days_ago"] == 0)
    expected_cash = cash.get("expected_cash") or (sales["today"] - expenses_today)
    executed = [a for a in store.all("Approvals") if a["status"] == "EXECUTED"]
    metrics = {
        "active_calls": len(calls.active()),
        "high_risk_transactions": sum(1 for t in txns if t.get("risk_level") == "HIGH"),
        "pending_approvals": len(approvals.pending()),
        "todays_sales": sales["today"],
        "sales_growth_pct": sales["growth_pct"],
        "inventory_alerts": sum(1 for i in store.all("Inventory") if i["stock"] < i["min_stock"] and not i.get("incoming")),
        "outstanding_credit": sum(c["outstanding"] for c in store.all("Customer Credit")),
        "predicted_payment_failures": sum(1 for r in radar if r["category"] == "Payment" and r["level"] == "HIGH"),
        "ai_actions": len(executed) + sum(1 for l in logs if l["kind"] == "tool_write"),
        "executed_actions": len(executed),
    }
    return {
        "version": store.version,
        "metrics": metrics,
        "radar": radar,
        "approvals": [approvals.as_card(a) for a in reversed(store.all("Approvals"))][:30],
        "runs": flow.recent(12),
        "calls": list(reversed(store.all("Calls")))[:5],
        "activity": audit.recent(80),
        "outbox": list(reversed(store.all("Outbox")))[:30],
        "transactions": list(reversed(txns))[:15],
        "fraud_cases": list(reversed(store.all("Fraud Cases"))),
        "claims": list(reversed(store.all("Insurance Claims"))),
        "financial": store.get("Financial Data", "U001"),
        "recurring": store.all("Recurring Payments", user_id="U001"),
        "predictions": list(reversed(store.all("Payment Predictions")))[:6],
        "payment_plans": store.all("Payment Plans"),
        "inventory": store.all("Inventory"),
        "customer_credit": store.all("Customer Credit"),
        "orders": list(reversed(store.all("Orders"))),
        "campaigns": list(reversed(store.all("Campaigns"))),
        "sales": sales,
        "expenses": [e for e in store.all("Expenses") if e["days_ago"] == 0],
        "cash": {**cash, "expected_cash": expected_cash, "variance": cash.get("variance") if cash.get("variance") is not None else cash.get("actual_cash", 0) - expected_cash},
        "suppliers": store.all("Suppliers"),
        "vendors": [m for m in store.all("Merchants") if m.get("role") == "vendor"],
        "agents": agents_status(),
        "tools": [{"name": t.name, "agent": t.agent, "mutates": t.mutates} for t in TOOLS.values()],
        "integrations": integrations(),
        "shield": scam_shield.recent(4),
        "documents": [{**d, "image_url": f"/api/snap/image/{d['doc_id']}"} for d in reversed(store.all("Documents"))][:8],
    }


# ── end-user app (one person's view — no agent internals) ────────────────────
CONSUMER_RADAR = {"Fraud", "Payment", "Insurance", "Income"}


def cash_today() -> dict:
    cash = next((r for r in store.all("Cash Reconciliation") if r["days_ago"] == 0), {})
    sales = sales_view()
    expenses = sum(e["amount"] for e in store.all("Expenses") if e["days_ago"] == 0)
    expected = cash.get("expected_cash") or (sales["today"] - expenses)
    variance = cash.get("variance") if cash.get("variance") is not None else (cash.get("actual_cash") or 0) - expected
    return {**cash, "expected_cash": expected, "variance": variance}


def user_app(user_id: str) -> dict | None:
    user = store.get("Users", user_id)
    if not user:
        return None
    mine = [a for a in reversed(store.all("Approvals")) if a.get("user_id") == user_id]
    data = {
        "user": user,
        "pending": [approvals.as_card(a) for a in mine if a["status"] == "PENDING"],
        "history": [approvals.as_card(a) for a in mine if a["status"] != "PENDING"][:15],
        "call": next((c for c in reversed(store.all("Calls")) if c["user_id"] == user_id and c["status"] != "COMPLETED"), None),
        "last_call": next((c for c in reversed(store.all("Calls")) if c["user_id"] == user_id), None),
        "shield": next((s for s in reversed(store.all("Shield Sessions")) if s["user_id"] == user_id), None),
        "documents": [{**d, "image_url": f"/api/snap/image/{d['doc_id']}"} for d in reversed(store.all("Documents")) if d["user_id"] == user_id][:5],
        "phone_ready": vobiz.enabled,
        "version": store.version,
    }
    if user["role"] == "consumer":
        fin = store.get("Financial Data", user_id)
        data.update({
            "financial": fin,
            "alerts": [r for r in financial_radar(user_id) if r["category"] in CONSUMER_RADAR],
            "transactions": list(reversed(store.all("Transactions", user_id=user_id)))[:8],
            "recurring": sorted(store.all("Recurring Payments", user_id=user_id), key=lambda r: r["due_in_days"]),
            "fraud_cases": list(reversed(store.all("Fraud Cases", user_id=user_id))),
            "claims": list(reversed(store.all("Insurance Claims", user_id=user_id))),
            "plans": store.all("Payment Plans", user_id=user_id),
            "orders": [o for o in reversed(store.all("Orders")) if o["type"] == "COMMERCE_ORDER"],
        })
    else:
        sales = sales_view()
        attention = [r for r in financial_radar("U001") if r["category"] in {"Receivable", "Inventory"}]
        if sales["evening_change_pct"] <= -10 and not any(c["status"] == "LIVE" for c in store.all("Campaigns") if c.get("opportunity")):
            attention.append({"id": "evening", "level": "MEDIUM", "category": "Sales", "title": f"Evening sales {sales['evening_change_pct']:+.0f}%",
                              "subtitle": f"Regular customers {sales['customers_change_pct']:+.0f}% this week",
                              "action": {"label": "Plan an offer", "prompt": "Evening sales are down — suggest a campaign"}})
        data.update({
            "merchant": store.get("Merchants", user.get("merchant_id", "MER-001")),
            "sales": sales,
            "expenses": sum(e["amount"] for e in store.all("Expenses") if e["days_ago"] == 0),
            "cash": cash_today(),
            "attention": attention,
            "inventory": store.all("Inventory"),
            "credit": store.all("Customer Credit"),
            "orders": [o for o in reversed(store.all("Orders")) if o["type"] == "PURCHASE_ORDER"],
            "campaigns": [c for c in reversed(store.all("Campaigns")) if c.get("opportunity")],
        })
    return data
