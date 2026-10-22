"""Snap & Act — a photo of paper becomes verified actions.

khata page    → reconcile with Customer Credit → approve → credit book updated
supplier bill → match against PO / agreed cost → catch overcharge → dispute + record delivery
shelf photo   → map to inventory → reorder what's running low
"""
from __future__ import annotations

import base64
import threading

from backend.integrations.telegram import telegram
from backend.services import approvals, audit, flow
from backend.services.store import store
from backend.tools.registry import call, ok
from backend.utils.helpers import inr, now_iso

LABELS = {"khata": "Khata (credit book) page", "supplier_bill": "Supplier bill", "shelf": "Shelf photo", "other": "Photo"}
_images: dict[str, tuple[bytes, str]] = {}
_lock = threading.Lock()


def image(doc_id: str) -> tuple[bytes, str] | None:
    with _lock:
        return _images.get(doc_id)


def process(data: bytes, media_type: str = "image/jpeg", *, user_id: str = "M001", source: str = "app",
            sample: str | None = None) -> dict:
    doc_id = store.next_id("DOC")
    with _lock:
        _images[doc_id] = (data, media_type)
    run = flow.start(f"📷 Photo from {source}" + (f" (sample: {sample})" if sample else ""), source="snap", user_id=user_id,
                     channel="camera", language="kanglish")
    run_id = run["run_id"]
    with flow.bind(run_id):
        read = call("read_document_image", image_b64=base64.b64encode(data).decode(), media_type=media_type, sample=sample)
        if read["status"] != "SUCCESS":
            flow.update(run_id, status="FAILED", stage="UNDERSTOOD", reply="Sorry, I couldn't read that photo.")
            row = {"doc_id": doc_id, "user_id": user_id, "source": source, "sample": sample, "doc_type": "other", "extraction": None,
                   "findings": {}, "status": "FAILED", "run_id": run_id, "created_at": now_iso(),
                   "reply": "Kshamisi, photo odalu aagilla. Innondu sala, belaku iruva kade photo tegeyiri.",
                   "reply_en": "Sorry, I couldn't read that photo. Please try again in better light.", "approval_ids": []}
            store.insert("Documents", row)
            return row
        ex = read["data"]
        doc_type = ex["doc_type"]
        flow.stage(run_id, "UNDERSTOOD", understood={"intents": [f"snap_{doc_type}"], "agents": ["merchant_ops"],
                                                     "entities": {"doc_type": doc_type, "confidence": ex.get("confidence")},
                                                     "risk_level": "LOW", "engine": ex.get("engine"), "reasoning": ex.get("summary", "")})
        row = {"doc_id": doc_id, "user_id": user_id, "source": source, "sample": sample, "doc_type": doc_type, "extraction": ex,
               "findings": {}, "status": "ANALYZED", "run_id": run_id, "created_at": now_iso(), "approval_ids": []}
        store.insert("Documents", row)
        proposals: list[dict] = []
        if doc_type == "khata":
            rec = ok(call("reconcile_khata", entries=ex["khata_entries"]))
            store.update("Documents", doc_id, {"findings": {"khata": rec}})
            for c in rec["changes"]:
                flow.add_data(run_id, c["name"], f"{inr(c.get('old'))} → {inr(c['amount'])}" if c["kind"] == "update" else f"new · {inr(c['amount'])}")
            if rec["changes"]:
                parts = []
                if rec["new_customers"]:
                    parts.append(f"{rec['new_customers']} new customer{'s' if rec['new_customers'] > 1 else ''} ({inr(rec['new_credit'])})")
                updates = [c for c in rec["changes"] if c["kind"] == "update"]
                if updates:
                    parts.append(", ".join(f"{c['name']} {inr(c['old'])}→{inr(c['amount'])}" for c in updates))
                proposals.append(dict(action="UPDATE_CREDIT_BOOK", description=f"Update credit book from photo: {'; '.join(parts)}",
                                      params={"doc_id": doc_id, "changes": rec["changes"]}, amount=rec["new_credit"] or None,
                                      target="Customer Credit sheet", impact="Your digital khata matches the paper one",
                                      reason=f"{len(rec['changes'])} difference(s) between the photo and the sheet"))
            decision = "Sync paper khata into the credit sheet" if rec["changes"] else "Paper and digital khata already match"
            reply = (f"Khata page odide: {len(ex['khata_entries'])} entries. " +
                     (f"{len(rec['changes'])} badalavane kandu bantu — update maadla?" if rec["changes"] else "Ella entries sheet jothe match aagive ✓"))
            reply_en = (f"Read {len(ex['khata_entries'])} khata entries. " +
                        (f"Found {len(rec['changes'])} change(s) — shall I update your credit sheet?" if rec["changes"] else "Everything already matches ✓"))
        elif doc_type == "supplier_bill":
            bill = ex["bill"]
            match = ok(call("match_bill_to_order", supplier=bill.get("supplier"), items=bill["items"]))
            store.update("Documents", doc_id, {"findings": {"match": match}})
            for l in match["lines"]:
                flow.add_data(run_id, l["name"], f"{l['quantity']:g} × {inr(l['unit_price'])}" + (f" (agreed {inr(l['expected_price'])})" if l["expected_price"] is not None else ""))
            flow.add_data(run_id, "Billed vs fair", f"{inr(match['billed_total'])} vs {inr(match['fair_total'])}")
            if match["overcharge"] > 0:
                proposals.append(dict(action="DISPUTE_BILL", description=f"Ask {bill.get('supplier') or 'the supplier'} to correct the {inr(match['overcharge'])} overcharge",
                                      params={"doc_id": doc_id}, amount=match["overcharge"], target=bill.get("supplier") or "Supplier",
                                      impact=f"Save {inr(match['overcharge'])}", reason="; ".join(match["issues"])))
            received = ", ".join(f"{l['quantity']:g} {l.get('unit') or ''} {l['item']}".replace("  ", " ") for l in match["lines"] if l["sku"])
            proposals.append(dict(action="RECORD_BILL", description=f"Record delivery ({received}) at the fair amount {inr(match['fair_total'])}",
                                  params={"doc_id": doc_id}, amount=match["fair_total"], target="Inventory + expenses",
                                  impact="Stock and books updated from the bill", reason=match["summary"]))
            decision = "Bill overcharged → dispute it and record only the fair amount" if match["overcharge"] else "Bill matches → record the delivery"
            if match["overcharge"]:
                reply = (f"Bill odide: {bill.get('supplier') or 'supplier'}, {inr(match['billed_total'])}. "
                         f"Agreed rate prakaara {inr(match['fair_total'])} aagbeku — {inr(match['overcharge'])} jaasti charge maadiddare! Supplier-ge message kalisla?")
                reply_en = f"Bill read: {inr(match['billed_total'])}, but the agreed rate makes it {inr(match['fair_total'])} — you're overcharged {inr(match['overcharge'])}. Shall I message the supplier?"
            else:
                reply = f"Bill odide: {inr(match['billed_total'])}, agreed rate jothe match aagide ✓ Stock update maadla?"
                reply_en = f"Bill read: {inr(match['billed_total'])}, matches the agreed rates ✓ Shall I record the delivery?"
        elif doc_type == "shelf":
            shelf = ok(call("assess_shelf", items=ex["shelf_items"]))
            store.update("Documents", doc_id, {"findings": {"shelf": shelf}})
            for s in shelf["items"]:
                flow.add_data(run_id, s["name"], s["level"].upper())
            for s in shelf["flagged"][:2]:
                plan = ok(call("calculate_reorder", sku=s["sku"]))
                proposals.append(dict(action="CREATE_PURCHASE_ORDER", description=f"Order {plan['recommended_qty']:g} {plan['unit']} {plan['item']} from {plan['supplier']}",
                                      params={"sku": plan["sku"], "quantity": plan["recommended_qty"], "supplier_id": plan["supplier_id"]},
                                      amount=plan["estimated_cost"], target=plan["supplier"], impact=f"Shelf shows {s['item']} {s['level']}",
                                      reason=plan["summary"]))
            names = ", ".join(s["item"] for s in shelf["flagged"]) or "nothing"
            decision = "Reorder what the shelf shows as low" if shelf["flagged"] else "Shelf looks fine"
            reply = f"Shelf photo nodide: {names} kammi ide. Order maadla?" if shelf["flagged"] else "Shelf chennagide ✓"
            reply_en = f"Shelf check: {names} running low. Shall I reorder?" if shelf["flagged"] else "Shelf looks well stocked ✓"
        else:
            decision = "Not a khata, bill or shelf — nothing to do"
            reply = "Idu khata, bill athava shelf photo alla anisutte."
            reply_en = "This doesn't look like a khata page, bill or shelf."

        flow.stage(run_id, "DECIDED", decision=decision, agents=["merchant_ops"])
        ids = []
        for p in proposals:
            a = approvals.propose(agent="merchant_ops", user_id=user_id, run_id=run_id, **p)
            ids.append(a["approval_id"])
        if ids:
            flow.stage(run_id, "APPROVAL", status="AWAITING_APPROVAL")
        else:
            flow.update(run_id, stage="VERIFIED", status="COMPLETED", action="Photo read — no changes needed",
                        verified="Compared against stored records")
        store.update("Documents", doc_id, {"reply": reply, "reply_en": reply_en, "approval_ids": ids})
        flow.update(run_id, reply=f"{reply}\n{reply_en}")
        audit.record(f"Snap & Act: {LABELS[doc_type]} read ({ex.get('engine')}) — {decision}", agent="merchant_ops",
                     tool="read_document_image", status="INFO", kind="snap", run_id=run_id, user=user_id)
    return store.get("Documents", doc_id)


def from_telegram(data: bytes, chat_id: str) -> None:
    doc = process(data, "image/jpeg", user_id="M001", source="telegram")
    approvals_n = len(doc.get("approval_ids") or [])
    telegram.reply(chat_id, f"📷 <b>{LABELS.get(doc['doc_type'], 'Photo')}</b>\n{doc.get('reply')}\n<i>{doc.get('reply_en')}</i>"
                   + (f"\n\n{approvals_n} action(s) sent for your approval ↓" if approvals_n else ""))


def recent(limit: int = 8) -> list[dict]:
    return list(reversed(store.all("Documents")))[:limit]


# ── approval handlers ────────────────────────────────────────────────────────
@approvals.handler("UPDATE_CREDIT_BOOK")
def update_credit(params: dict, approval: dict) -> dict:
    res = call("update_credit_book", changes=params["changes"])
    data = res.get("data") or {}
    rows = {c["customer_id"]: c for c in store.all("Customer Credit")}
    verified = bool(data.get("applied")) and all(cid in rows for cid in data["applied"])
    store.update("Documents", params["doc_id"], {"status": "APPLIED"}) if verified else None
    return {"summary": data.get("summary", "Credit book update failed"), "verified": verified,
            "verification": f"Customer Credit rows {', '.join(data.get('applied', []))} saved",
            "steps": [{"tool": res["tool"], "status": res["status"], "summary": data.get("summary")}]}


@approvals.handler("DISPUTE_BILL")
def dispute(params: dict, approval: dict) -> dict:
    res = call("dispute_bill", doc_id=params["doc_id"])
    doc = store.get("Documents", params["doc_id"]) or {}
    verified = bool(doc.get("dispute"))
    return {"summary": (res.get("data") or {}).get("summary", "Dispute failed"), "verified": verified,
            "verification": f"Documents[{params['doc_id']}].dispute recorded; Telegram message queued",
            "steps": [{"tool": res["tool"], "status": res["status"], "summary": (res.get("data") or {}).get("summary")}]}


@approvals.handler("RECORD_BILL")
def record_bill(params: dict, approval: dict) -> dict:
    res = call("record_supplier_bill", doc_id=params["doc_id"])
    doc = store.get("Documents", params["doc_id"]) or {}
    verified = doc.get("status") == "RECORDED"
    return {"summary": (res.get("data") or {}).get("summary", "Recording failed"), "verified": verified,
            "verification": f"Documents[{params['doc_id']}].status = {doc.get('status')}; inventory and expenses updated",
            "steps": [{"tool": res["tool"], "status": res["status"], "summary": (res.get("data") or {}).get("summary")}]}
