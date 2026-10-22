"""Commerce Agent tools — natural-language purchasing."""
from __future__ import annotations

import re

from backend.integrations.telegram import telegram
from backend.services.store import store
from backend.tools.registry import ToolError, tool
from backend.utils.helpers import inr, now_iso

AGENT = "commerce"

SYNONYMS = {"notebooks": "notebook", "note books": "notebook", "books": "notebook", "pens": "pen", "ball pens": "pen"}
WORD_NUMBERS = {"one": 1, "two": 2, "five": 5, "ten": 10, "twenty": 20, "fifty": 50, "hundred": 100}


def _canon(name: str) -> str:
    name = name.lower().strip()
    return SYNONYMS.get(name, name.rstrip("s") if name.endswith("s") else name)


@tool("parse_purchase_intent", AGENT)
def parse_purchase_intent(text: str, items: list[dict] | None = None, budget: float | None = None,
                          deadline: str | None = None) -> dict:
    """Structured purchase intent. Uses Claude's extraction when given, else regex."""
    if not items:
        items = []
        for qty, name in re.findall(r"(\d+|" + "|".join(WORD_NUMBERS) + r")\s+([a-zA-Z][a-zA-Z ]{1,20}?)(?=\s+(?:and|,|tomorrow|today|under|by|for)|[,.]|$)", text.lower()):
            items.append({"name": _canon(name), "quantity": int(WORD_NUMBERS.get(qty, qty) if not qty.isdigit() else qty)})
    else:
        items = [{"name": _canon(i["name"]), "quantity": int(i["quantity"])} for i in items]
    if budget is None:
        match = re.search(r"(?:under|below|within|max|budget)\s*(?:₹|rs\.?|inr)?\s*([\d,]+)", text.lower())
        budget = float(match.group(1).replace(",", "")) if match else None
    if not deadline:
        lowered = text.lower()
        deadline = "tomorrow" if any(w in lowered for w in ("tomorrow", "kal", "naale", "nale")) else "today" if "today" in lowered else "flexible"
    if not items:
        raise ToolError("could not find any items in the request")
    return {"items": items, "budget": budget, "deadline": deadline,
            "summary": ", ".join(f"{i['quantity']} {i['name']}" for i in items) + (f" under {inr(budget)}" if budget else "")}


@tool("find_merchants", AGENT)
def find_merchants(items: list[dict]) -> dict:
    """Vendors that sell every requested item."""
    names = {_canon(i["name"]) for i in items}
    vendors = [m for m in store.all("Merchants") if m.get("role") == "vendor" and names <= set(m["catalog"])]
    return {"merchants": [{"merchant_id": m["merchant_id"], "name": m["name"], "rating": m["rating"], "distance_km": m["distance_km"]} for m in vendors],
            "summary": f"{len(vendors)} merchants found"}


@tool("check_availability", AGENT)
def check_availability(merchant_id: str, items: list[dict]) -> dict:
    """Stock check at one vendor."""
    vendor = store.get("Merchants", merchant_id)
    if not vendor:
        raise ToolError(f"{merchant_id} not found")
    lines = [{"name": i["name"], "quantity": i["quantity"], "in_stock": vendor["catalog"][_canon(i["name"])]["stock"]} for i in items]
    available = all(line["in_stock"] >= line["quantity"] for line in lines)
    return {"merchant_id": merchant_id, "available": available, "lines": lines,
            "summary": f"{vendor['name']}: {'available' if available else 'insufficient stock'}"}


@tool("compare_prices", AGENT)
def compare_prices(items: list[dict], merchant_ids: list[str], budget: float | None = None, deadline: str = "flexible") -> dict:
    """Quote each vendor, filter by stock, budget and deadline, pick the best."""
    quotes = []
    for mid in merchant_ids:
        vendor = store.get("Merchants", mid)
        lines = [{"name": i["name"], "quantity": i["quantity"], "unit_price": vendor["catalog"][_canon(i["name"])]["price"],
                  "in_stock": vendor["catalog"][_canon(i["name"])]["stock"]} for i in items]
        total = sum(line["quantity"] * line["unit_price"] for line in lines)
        in_stock = all(line["in_stock"] >= line["quantity"] for line in lines)
        on_time = deadline != "tomorrow" or vendor["delivery"].lower().startswith("tomorrow")
        within = budget is None or total <= budget
        rejected = None if in_stock and on_time and within else ("insufficient stock" if not in_stock else "misses deadline" if not on_time else "over budget")
        quotes.append({"merchant_id": mid, "name": vendor["name"], "total": total, "delivery": vendor["delivery"], "rating": vendor["rating"],
                       "lines": lines, "eligible": rejected is None, "rejected_reason": rejected})
    eligible = sorted([q for q in quotes if q["eligible"]], key=lambda q: (q["total"], -q["rating"]))
    best = eligible[0] if eligible else None
    return {"quotes": sorted(quotes, key=lambda q: q["total"]), "best": best,
            "savings_vs_next": (eligible[1]["total"] - best["total"]) if len(eligible) > 1 else 0,
            "summary": f"Best: {best['name']} {inr(best['total'])} · {best['delivery']}" if best else "No vendor meets the constraints"}


@tool("send_merchant_request", AGENT, mutates=True)
def send_merchant_request(merchant_id: str, items: list[dict], total: float, delivery: str) -> dict:
    """Send the order request to the vendor (Telegram) — they must accept."""
    vendor = store.get("Merchants", merchant_id)
    request_id = store.next_id("ORD")
    order = {
        "order_id": request_id,
        "type": "COMMERCE_ORDER",
        "merchant_id": "U001",
        "counterparty": vendor["name"],
        "counterparty_id": merchant_id,
        "items": items,
        "amount": total,
        "delivery": delivery,
        "status": "AWAITING_MERCHANT",
        "created_at": now_iso(),
        "timeline": [{"ts": now_iso(), "event": "Request sent to merchant"}],
    }
    store.insert("Orders", order)
    text = (f"🛒 <b>ORDER REQUEST {request_id}</b>\n\n" + "\n".join(f"{i['name'].title()} × {i['quantity']}" for i in items) +
            f"\n\nTotal — {inr(total)}\nDelivery — {delivery}\n\nRequested via SAATHI AI")
    msg = telegram.send(role="supplier", title=f"Order request · {vendor['name']}", text=text, related_id=request_id,
                        buttons=[("✅ ACCEPT", f"ord:{request_id}:accept"), ("❌ REJECT", f"ord:{request_id}:reject")])
    return {"order_id": request_id, "status": "AWAITING_MERCHANT", "delivered": msg["will_deliver"], "simulated": True,
            "summary": f"Request {request_id} sent to {vendor['name']}"}


@tool("get_merchant_response", AGENT)
def get_merchant_response(order_id: str) -> dict:
    """Current merchant response for an order request."""
    order = store.get("Orders", order_id)
    if not order:
        raise ToolError(f"{order_id} not found")
    return {"order_id": order_id, "status": order["status"], "summary": order["status"]}


@tool("create_order", AGENT, mutates=True)
def create_order(order_id: str) -> dict:
    """Confirm the order once the merchant has accepted."""
    order = store.get("Orders", order_id)
    if not order:
        raise ToolError(f"{order_id} not found")
    if order["status"] not in {"MERCHANT_ACCEPTED", "CONFIRMED"}:
        raise ToolError(f"merchant has not accepted (status {order['status']})")
    store.mutate("Orders", order_id, lambda o: (o.update({"status": "CONFIRMED", "confirmed_at": now_iso()}),
                                                o["timeline"].append({"ts": now_iso(), "event": "Order confirmed"})))
    return {"order_id": order_id, "status": "CONFIRMED", "total": order["amount"], "delivery": order["delivery"],
            "simulated": True, "summary": f"ORDER CONFIRMED · {inr(order['amount'])} · {order['delivery']}"}
