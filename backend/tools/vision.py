"""Snap & Act tools — read a photo, then reconcile it against our records.

Only `read_document_image` uses AI (perception). Matching, price checks and every
record change are deterministic backend code, as everywhere else in SAATHI.
"""
from __future__ import annotations

import difflib
import json
import re

from backend.config import ROOT
from backend.integrations.claude_client import claude
from backend.integrations.telegram import telegram
from backend.services.store import store
from backend.tools.registry import ToolError, tool
from backend.utils.helpers import inr, now_iso

AGENT = "merchant_ops"
SAMPLES = ROOT / "data" / "samples"

_n = lambda t: {"type": [t, "null"]}  # noqa: E731
READ_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["doc_type", "confidence", "summary", "khata_entries", "bill", "shelf_items"],
    "properties": {
        "doc_type": {"type": "string", "enum": ["khata", "supplier_bill", "shelf", "other"]},
        "confidence": {"type": "number"},
        "summary": {"type": "string"},
        "khata_entries": {"type": "array", "items": {
            "type": "object", "additionalProperties": False, "required": ["name", "amount", "note"],
            "properties": {"name": {"type": "string"}, "amount": {"type": "number"}, "note": _n("string")}}},
        "bill": {"type": "object", "additionalProperties": False, "required": ["supplier", "bill_number", "date", "items", "total"],
                 "properties": {
                     "supplier": _n("string"), "bill_number": _n("string"), "date": _n("string"), "total": _n("number"),
                     "items": {"type": "array", "items": {
                         "type": "object", "additionalProperties": False,
                         "required": ["name", "quantity", "unit", "unit_price", "line_total"],
                         "properties": {"name": {"type": "string"}, "quantity": {"type": "number"}, "unit": _n("string"),
                                        "unit_price": {"type": "number"}, "line_total": _n("number")}}}}},
        "shelf_items": {"type": "array", "items": {
            "type": "object", "additionalProperties": False, "required": ["name", "level"],
            "properties": {"name": {"type": "string"}, "level": {"type": "string", "enum": ["empty", "low", "half", "full"]}}}},
    },
}
READ_SYSTEM = """You read photos for a small Indian kirana store. Identify the document and extract it exactly.
- khata: a handwritten customer credit (udhaar) book page. One entry per customer: the CURRENT amount they owe
  (if a line shows a payment like '4500 - 1000 paid', the amount is what remains). Names in Latin script.
- supplier_bill: a printed or handwritten purchase invoice. Extract every line item with quantity, unit, unit price.
- shelf: a photo of shelves/bins/sacks. For each product you can identify, estimate how full it is.
- other: anything else.
Fill only the section for the detected doc_type; leave the others empty (empty arrays, null bill fields).
Never invent items you cannot see. Amounts are rupees as plain numbers."""


def _expected(sample: str) -> dict | None:
    path = SAMPLES / "expected.json"
    data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    return data.get(sample)


@tool("read_document_image", AGENT)
def read_document_image(image_b64: str, media_type: str = "image/jpeg", sample: str | None = None) -> dict:
    """Claude vision: classify the photo and extract its contents as structured JSON."""
    result = claude.vision(system=READ_SYSTEM, prompt="Read this photo for the store owner.", image_b64=image_b64,
                           media_type=media_type, schema=READ_SCHEMA)
    engine = "claude-vision"
    if result is None and sample:
        result, engine = _expected(sample), "sample-fallback"
    if result is None:
        raise ToolError("could not read the image (Claude vision unavailable)")
    return {**result, "engine": engine, "summary": result.get("summary") or result["doc_type"]}


def _best(name: str, options: dict[str, str], cutoff: float = 0.55) -> str | None:
    """Fuzzy match a written name to a known key (handles 'Sona masoori rice' vs 'Rice', 'Ramesh K.' vs 'Ramesh')."""
    low = name.lower().strip()
    for key, label in options.items():
        words = re.findall(r"[a-z]+", label.lower())
        if low == label.lower() or any(w in low for w in words if len(w) > 3):
            return key
    hit = difflib.get_close_matches(low, {v.lower(): k for k, v in options.items()}.keys(), n=1, cutoff=cutoff)
    if hit:
        return {v.lower(): k for k, v in options.items()}[hit[0]]
    return None


@tool("reconcile_khata", AGENT)
def reconcile_khata(entries: list[dict]) -> dict:
    """Compare a khata page with the Customer Credit sheet: new customers, changed balances, unchanged."""
    customers = {c["customer_id"]: c for c in store.all("Customer Credit")}
    names = {cid: c["name"] for cid, c in customers.items()}
    changes, same = [], []
    for e in entries:
        cid = _best(e["name"], names, cutoff=0.75)
        if cid is None:
            changes.append({"kind": "new", "name": e["name"].strip().title(), "amount": e["amount"], "note": e.get("note")})
        elif abs(customers[cid]["outstanding"] - e["amount"]) >= 1:
            changes.append({"kind": "update", "customer_id": cid, "name": customers[cid]["name"],
                            "old": customers[cid]["outstanding"], "amount": e["amount"], "note": e.get("note")})
        else:
            same.append(customers[cid]["name"])
    added = sum(c["amount"] for c in changes if c["kind"] == "new")
    return {"changes": changes, "unchanged": same, "new_customers": sum(1 for c in changes if c["kind"] == "new"),
            "new_credit": added, "summary": f"{len(changes)} change(s), {len(same)} unchanged"}


@tool("match_bill_to_order", AGENT)
def match_bill_to_order(supplier: str | None, items: list[dict]) -> dict:
    """Check each billed line against the open purchase order (or the agreed unit cost)."""
    inventory = {i["sku"]: i for i in store.all("Inventory")}
    labels = {sku: i["item"] for sku, i in inventory.items()}
    orders = [o for o in store.all("Orders") if o["type"] == "PURCHASE_ORDER" and o["status"] not in {"REJECTED", "DELIVERED"}]
    lines, overcharge = [], 0.0
    for it in items:
        sku = _best(it["name"], labels)
        order = next((o for o in reversed(orders) for l in o["items"] if l["sku"] == sku), None) if sku else None
        po_line = next((l for l in order["items"] if l["sku"] == sku), None) if order else None
        expected = po_line["unit_price"] if po_line else inventory[sku]["unit_cost"] if sku else None
        diff = (it["unit_price"] - expected) * it["quantity"] if expected is not None else 0
        issue = None
        if sku is None:
            issue = "Not a product we stock"
        elif diff > 0.5:
            issue = f"Charged {inr(it['unit_price'])}/{it.get('unit') or 'unit'} vs agreed {inr(expected)} — {inr(diff)} extra"
        elif po_line and abs(po_line["quantity"] - it["quantity"]) >= 1:
            issue = f"Billed {it['quantity']:g} but PO ordered {po_line['quantity']:g}"
        overcharge += max(0, diff)
        lines.append({**it, "sku": sku, "item": labels.get(sku), "expected_price": expected, "difference": round(diff, 2),
                      "order_id": order["order_id"] if order else None, "basis": "purchase order" if po_line else "agreed cost", "issue": issue})
    billed = sum(l["quantity"] * l["unit_price"] for l in lines)
    fair = sum(l["quantity"] * (l["expected_price"] if l["expected_price"] is not None else l["unit_price"]) for l in lines)
    return {"lines": lines, "billed_total": billed, "fair_total": fair, "overcharge": round(overcharge, 2),
            "issues": [l["issue"] for l in lines if l["issue"]],
            "summary": f"Bill {inr(billed)} vs fair {inr(fair)}" + (f" · overcharge {inr(overcharge)}" if overcharge else " · matches")}


@tool("assess_shelf", AGENT)
def assess_shelf(items: list[dict]) -> dict:
    """Map what the camera saw to inventory and flag anything empty or low."""
    inventory = {i["sku"]: i for i in store.all("Inventory")}
    labels = {sku: i["item"] for sku, i in inventory.items()}
    seen = []
    for it in items:
        sku = _best(it["name"], labels)
        seen.append({**it, "sku": sku, "item": labels.get(sku), "recorded_stock": inventory[sku]["stock"] if sku else None,
                     "unit": inventory[sku]["unit"] if sku else None, "needs_reorder": it["level"] in {"empty", "low"} and sku is not None})
    flagged = [s for s in seen if s["needs_reorder"]]
    return {"items": seen, "flagged": flagged, "summary": f"{len(seen)} items seen, {len(flagged)} running low"}


@tool("update_credit_book", AGENT, mutates=True)
def update_credit_book(changes: list[dict]) -> dict:
    """Apply approved khata changes to the Customer Credit sheet."""
    applied = []
    for c in changes:
        if c["kind"] == "update":
            store.update("Customer Credit", c["customer_id"], {"outstanding": c["amount"], "updated_from": "khata photo",
                                                               "updated_at": now_iso()})
            applied.append(c["customer_id"])
        else:
            cid = store.next_id("CUS")
            store.insert("Customer Credit", {"customer_id": cid, "merchant_id": "MER-001", "name": c["name"], "phone": "",
                                             "outstanding": c["amount"], "overdue_days": 0, "last_purchase_days_ago": 0,
                                             "status": "CURRENT", "reminders_sent": 0, "updated_from": "khata photo"})
            applied.append(cid)
    total = sum(c["outstanding"] for c in store.all("Customer Credit"))
    return {"applied": applied, "total_outstanding": total, "summary": f"{len(applied)} khata entries saved · total credit {inr(total)}"}


@tool("record_supplier_bill", AGENT, mutates=True)
def record_supplier_bill(doc_id: str) -> dict:
    """Record delivered goods from the bill: stock in, PO delivered, expense at the fair amount."""
    doc = store.get("Documents", doc_id)
    if not doc:
        raise ToolError(f"{doc_id} not found")
    match = doc["findings"]["match"]
    received = []
    for line in match["lines"]:
        if not line["sku"]:
            continue
        store.mutate("Inventory", line["sku"], lambda i, q=line["quantity"]: i.update(
            {"stock": i["stock"] + q, "incoming": None, "incoming_eta": None, "last_received": now_iso()}))
        received.append(f"{line['quantity']:g} {line.get('unit') or ''} {line['item']}".strip())
        if line["order_id"]:
            store.mutate("Orders", line["order_id"], lambda o: (o.update({"status": "DELIVERED", "delivered_at": now_iso()}),
                                                                o["timeline"].append({"ts": now_iso(), "event": "Delivered — bill photo recorded"})))
    store.insert("Expenses", {"expense_id": store.next_id("EXP"), "merchant_id": "MER-001", "days_ago": 0, "category": "Stock purchase",
                              "amount": match["fair_total"], "mode": "credit", "source": doc_id})
    store.update("Documents", doc_id, {"status": "RECORDED"})
    return {"received": received, "expense": match["fair_total"],
            "summary": f"Stock updated ({', '.join(received)}) · expense {inr(match['fair_total'])}"}


@tool("dispute_bill", AGENT, mutates=True)
def dispute_bill(doc_id: str) -> dict:
    """Message the supplier on Telegram about the overcharge."""
    doc = store.get("Documents", doc_id)
    if not doc:
        raise ToolError(f"{doc_id} not found")
    match = doc["findings"]["match"]
    supplier = doc["extraction"]["bill"].get("supplier") or "Supplier"
    lines = "\n".join(f"• {l['item']}: {inr(l['unit_price'])} billed vs {inr(l['expected_price'])} agreed ({inr(l['difference'])})"
                      for l in match["lines"] if l["difference"] > 0.5)
    msg = telegram.send(role="supplier", title=f"Bill correction · {supplier}", related_id=doc_id,
                        text=f"🧾 <b>Bill correction request</b>\n{supplier} · bill {doc['extraction']['bill'].get('bill_number') or ''}\n\n{lines}\n\n"
                             f"Please send a corrected bill for <b>{inr(match['fair_total'])}</b> (overcharge {inr(match['overcharge'])}).\n"
                             "— Lakshmi General Stores (via SAATHI)")
    store.update("Documents", doc_id, {"dispute": {"message_id": msg["message_id"], "amount": match["overcharge"], "at": now_iso()}})
    return {"message_id": msg["message_id"], "overcharge": match["overcharge"],
            "summary": f"Asked {supplier} to correct {inr(match['overcharge'])} overcharge"}
