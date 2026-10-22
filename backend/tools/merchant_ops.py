"""Merchant Operations Agent tools — sales, cash, inventory, suppliers, credit."""
from __future__ import annotations

import math

from backend.integrations.telegram import telegram
from backend.services.store import store
from backend.tools.registry import ToolError, tool
from backend.utils.helpers import inr, now_iso, today

AGENT = "merchant_ops"
MERCHANT = "MER-001"


@tool("get_sales_summary", AGENT)
def get_sales_summary(merchant_id: str = MERCHANT) -> dict:
    """Today vs yesterday sales."""
    rows = sorted(store.all("Sales", merchant_id=merchant_id), key=lambda r: r["days_ago"])
    if len(rows) < 2:
        raise ToolError("not enough sales history")
    today_row, yesterday = rows[0], rows[1]
    growth = (today_row["total"] - yesterday["total"]) / yesterday["total"] * 100
    return {"today": today_row["total"], "yesterday": yesterday["total"], "growth_pct": round(growth, 1),
            "today_breakdown": {k: today_row[k] for k in ("morning", "afternoon", "evening")},
            "series": [{"date": r["date"], "total": r["total"], "evening": r["evening"]} for r in reversed(rows)],
            "summary": f"Today {inr(today_row['total'])} ({growth:+.1f}%)"}


@tool("get_expenses", AGENT)
def get_expenses(merchant_id: str = MERCHANT, days_ago: int = 0) -> dict:
    """Expenses for a day."""
    rows = [r for r in store.all("Expenses", merchant_id=merchant_id) if r["days_ago"] == days_ago]
    return {"items": rows, "total": sum(r["amount"] for r in rows), "summary": f"Expenses {inr(sum(r['amount'] for r in rows))}"}


@tool("get_cash_records", AGENT)
def get_cash_records(merchant_id: str = MERCHANT) -> dict:
    """Expected cash (cash sales − cash expenses) vs counted cash for today."""
    sale = next(r for r in store.all("Sales", merchant_id=merchant_id) if r["days_ago"] == 0)
    expenses = sum(r["amount"] for r in store.all("Expenses", merchant_id=merchant_id) if r["days_ago"] == 0 and r["mode"] == "cash")
    record = next((r for r in store.all("Cash Reconciliation", merchant_id=merchant_id) if r["days_ago"] == 0), None)
    if not record:
        raise ToolError("no cash count for today")
    expected = round(sale["total"] * sale.get("cash_share", 1.0) - expenses)
    variance = record["actual_cash"] - expected
    return {"recon_id": record["recon_id"], "date": record["date"], "expected_cash": expected, "actual_cash": record["actual_cash"],
            "variance": variance, "status": record["status"],
            "summary": f"Expected {inr(expected)}, counted {inr(record['actual_cash'])}, variance {inr(variance)}"}


@tool("reconcile_cash", AGENT, mutates=True)
def reconcile_cash(recon_id: str, expected_cash: float, actual_cash: float, reason: str, approved_by: str) -> dict:
    """Close the day's cash book with the variance and its reason."""
    record = store.get("Cash Reconciliation", recon_id)
    if not record:
        raise ToolError(f"{recon_id} not found")
    if record["status"] == "RECONCILED":
        raise ToolError("already reconciled")
    variance = actual_cash - expected_cash
    updated = store.update("Cash Reconciliation", recon_id, {
        "expected_cash": expected_cash, "actual_cash": actual_cash, "variance": variance, "reason": reason,
        "approved_by": approved_by, "timestamp": now_iso(), "status": "RECONCILED"})
    return {**updated, "summary": f"Cash reconciled · variance {inr(variance)} recorded"}


@tool("check_inventory", AGENT)
def check_inventory(merchant_id: str = MERCHANT, item: str | None = None) -> dict:
    """Stock levels and low-stock alerts."""
    rows = store.all("Inventory", merchant_id=merchant_id)
    if item:
        rows = [r for r in rows if item.lower() in r["item"].lower() or item.lower() in r["sku"].lower()] or rows
    low = []
    for r in rows:
        days_left = r["stock"] / r["daily_usage"] if r["daily_usage"] else 99
        r["days_left"] = round(days_left, 1)
        r["level"] = "CRITICAL" if r["stock"] < r["min_stock"] * 0.5 else "LOW" if r["stock"] < r["min_stock"] else "OK"
        if r["level"] != "OK":
            low.append(r)
    return {"items": rows, "low_stock": low, "summary": f"{len(low)} item(s) below minimum" + (f": {', '.join(i['item'] for i in low)}" if low else "")}


@tool("calculate_reorder", AGENT)
def calculate_reorder(sku: str) -> dict:
    """Reorder quantity = shortfall to minimum + usage during lead time, rounded up to supplier packs."""
    item = store.get("Inventory", sku)
    if not item:
        raise ToolError(f"{sku} not found")
    needed = max(0, item["min_stock"] - item["stock"]) + item["daily_usage"] * item["lead_days"]
    packs = max(1, math.ceil(needed / item["pack_size"]))
    qty = packs * item["pack_size"]
    supplier = store.get("Suppliers", item["supplier_id"]) or {}
    return {"sku": sku, "item": item["item"], "unit": item["unit"], "stock": item["stock"], "min_stock": item["min_stock"],
            "recommended_qty": qty, "packs": packs, "unit_cost": item["unit_cost"], "estimated_cost": qty * item["unit_cost"],
            "supplier_id": item["supplier_id"], "supplier": supplier.get("name", ""), "delivery": supplier.get("delivery", ""),
            "summary": f"Order {qty} {item['unit']} {item['item']} ≈ {inr(qty * item['unit_cost'])}"}


@tool("create_purchase_order", AGENT, mutates=True)
def create_purchase_order(sku: str, quantity: float, supplier_id: str, approved_by: str) -> dict:
    """Create a PO and send it to the supplier on Telegram with ACCEPT / REJECT / COUNTER buttons."""
    item = store.get("Inventory", sku)
    supplier = store.get("Suppliers", supplier_id)
    if not item or not supplier:
        raise ToolError("unknown item or supplier")
    amount = quantity * item["unit_cost"]
    order = {
        "order_id": store.next_id("PO"),
        "type": "PURCHASE_ORDER",
        "merchant_id": item["merchant_id"],
        "counterparty": supplier["name"],
        "counterparty_id": supplier_id,
        "items": [{"sku": sku, "name": item["item"], "quantity": quantity, "unit": item["unit"], "unit_price": item["unit_cost"]}],
        "amount": amount,
        "delivery": supplier["delivery"],
        "status": "SENT_TO_SUPPLIER",
        "approved_by": approved_by,
        "created_at": now_iso(),
        "timeline": [{"ts": now_iso(), "event": "PO created"}],
    }
    store.insert("Orders", order)
    text = (f"🧾 <b>PURCHASE ORDER {order['order_id']}</b>\n\n<b>{supplier['name']}</b>\n\n"
            f"{item['item']} — {quantity:g} {item['unit']}\nEstimated amount — {inr(amount)}\nDelivery — {supplier['delivery']}\n\n"
            f"From: Lakshmi General Stores, Mysuru (via SAATHI)")
    message = telegram.send(role="supplier", title=f"Purchase order {order['order_id']}", text=text, related_id=order["order_id"],
                            buttons=[("✅ ACCEPT", f"po:{order['order_id']}:accept"), ("❌ REJECT", f"po:{order['order_id']}:reject"),
                                     ("💬 COUNTER OFFER", f"po:{order['order_id']}:counter")])
    store.mutate("Orders", order["order_id"], lambda o: o["timeline"].append(
        {"ts": now_iso(), "event": "Sent to supplier on Telegram" + ("" if message["will_deliver"] else " (dashboard outbox)")}))
    return {"order_id": order["order_id"], "amount": amount, "status": order["status"], "telegram_delivered": message["will_deliver"],
            "simulated": True, "summary": f"{order['order_id']} sent to {supplier['name']}"}


@tool("get_customer_credit", AGENT)
def get_customer_credit(merchant_id: str = MERCHANT, name: str | None = None) -> dict:
    """Outstanding customer credit (udhaar)."""
    rows = store.all("Customer Credit", merchant_id=merchant_id)
    if name:
        rows = [r for r in rows if r["name"].lower() == name.lower()]
        if not rows:
            raise ToolError(f"no credit record for {name}")
    return {"customers": rows, "total_outstanding": sum(r["outstanding"] for r in rows),
            "overdue": [r for r in rows if r["overdue_days"] > 0],
            "summary": f"Outstanding {inr(sum(r['outstanding'] for r in rows))}"}


@tool("send_payment_reminder", AGENT, mutates=True)
def send_payment_reminder(customer_id: str, message: str) -> dict:
    """Send a polite payment reminder on Telegram and record it."""
    customer = store.get("Customer Credit", customer_id)
    if not customer:
        raise ToolError(f"{customer_id} not found")
    sent = telegram.send(role="customer", title=f"Payment reminder · {customer['name']}", text=message, related_id=customer_id)
    store.update("Customer Credit", customer_id, {
        "reminders_sent": customer["reminders_sent"] + 1, "last_reminder_at": now_iso(),
        "last_reminder_message": message, "reminder_status": "REMINDER SENT"})
    return {"customer": customer["name"], "amount": customer["outstanding"], "message": message, "timestamp": now_iso(),
            "status": "REMINDER SENT", "delivered": sent["will_deliver"], "simulated": sent["simulated"],
            "summary": f"Reminder sent to {customer['name']} for {inr(customer['outstanding'])}"}


def today_label() -> str:
    return today().strftime("%d %b")
