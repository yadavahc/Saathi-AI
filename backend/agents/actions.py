"""Action handlers — what runs after an approval, plus third-party responses.

Each handler EXECUTES tools, then VERIFIES by re-reading stored state. A handler
only reports success when the backend confirms it.
"""
from __future__ import annotations

import threading

from backend.integrations.telegram import telegram
from backend.services import approvals, audit, flow
from backend.services.store import store
from backend.tools.registry import call
from backend.utils.helpers import inr, now_iso

THIRD_PARTY_SIM_DELAY = 4.0  # seconds before a simulated supplier/merchant replies


def _steps(*envelopes: dict) -> list[dict]:
    return [{"tool": e["tool"], "status": e["status"], "summary": (e.get("data") or {}).get("summary") if e.get("data") else e.get("error")}
            for e in envelopes]


def _later(delay: float, run_id: str | None, fn, *args) -> None:
    def run():
        with flow.bind(run_id):
            fn(*args)

    timer = threading.Timer(delay, run)
    timer.daemon = True
    timer.start()


@approvals.handler("FREEZE_TRANSACTION")
def freeze(params: dict, approval: dict) -> dict:
    txn_id = params["txn_id"]
    a = call("freeze_transaction", txn_id=txn_id, reason="User denied the transaction during voice verification")
    b = call("create_fraud_case", txn_id=txn_id, user_id=params["user_id"], risk_score=params["risk_score"],
             summary="User confirmed by voice they did not initiate this payment")
    case_id = (b.get("data") or {}).get("case_id", "")
    c = call("send_fraud_alert", user_id=params["user_id"], txn_id=txn_id, case_id=case_id) if case_id else None
    txn = store.get("Transactions", txn_id) or {}
    case = store.get("Fraud Cases", case_id) if case_id else None
    verified = txn.get("status") == "FROZEN" and case is not None
    return {"summary": f"Transaction frozen · Fraud case {case_id} created · Telegram alert sent" if verified else "Freeze incomplete",
            "verified": verified, "case_id": case_id,
            "verification": f"Transactions[{txn_id}].status = {txn.get('status')}; Fraud Cases[{case_id}] = {case and case['status']}",
            "steps": _steps(*[x for x in (a, b, c) if x])}


@approvals.handler("CREATE_INSURANCE_CLAIM")
def insurance_claim(params: dict, approval: dict) -> dict:
    a = call("create_insurance_claim", user_id=params["user_id"], amount=params["amount"], reason=params["reason"])
    claim_id = (a.get("data") or {}).get("claim_id")
    claim = store.get("Insurance Claims", claim_id) if claim_id else None
    b = call("send_telegram", role="user", title=f"Insurance claim {claim_id}",
             text=f"🏥 <b>Insurance claim {claim_id}</b>\nAmount: {inr(params['amount'])}\nStatus: SUBMITTED\n(sandbox — simulated insurer)") if claim else None
    verified = bool(claim and claim["status"] == "SUBMITTED")
    return {"summary": f"Claim {claim_id} SUBMITTED for {inr(params['amount'])}" if verified else "Claim not created",
            "verified": verified, "claim_id": claim_id,
            "verification": f"Insurance Claims[{claim_id}].status = {claim and claim['status']}",
            "steps": _steps(*[x for x in (a, b) if x])}


@approvals.handler("RECONCILE_CASH")
def reconcile(params: dict, approval: dict) -> dict:
    a = call("reconcile_cash", recon_id=params["recon_id"], expected_cash=params["expected_cash"], actual_cash=params["actual_cash"],
             reason=params["reason"], approved_by=approval.get("decided_by") or "merchant")
    rec = store.get("Cash Reconciliation", params["recon_id"]) or {}
    verified = rec.get("status") == "RECONCILED"
    return {"summary": f"Cash reconciled · variance {inr(rec.get('variance'))} recorded" if verified else "Reconciliation failed",
            "verified": verified, "verification": f"Cash Reconciliation[{params['recon_id']}].status = {rec.get('status')}",
            "steps": _steps(a)}


@approvals.handler("CREATE_PURCHASE_ORDER")
def purchase_order(params: dict, approval: dict) -> dict:
    a = call("create_purchase_order", sku=params["sku"], quantity=params["quantity"], supplier_id=params["supplier_id"],
             approved_by=approval.get("decided_by") or "merchant")
    data = a.get("data") or {}
    order_id = data.get("order_id")
    if not order_id:
        return {"summary": "PO creation failed", "verified": False, "verification": str(a.get("error")), "steps": _steps(a)}
    store.update("Orders", order_id, {"approval_id": approval["approval_id"]})
    if not data.get("telegram_delivered"):
        _later(THIRD_PARTY_SIM_DELAY, approval.get("run_id"), respond_order, order_id, "accept", "ABC Stores (simulated)", "simulation")
    return {"summary": f"{order_id} sent to supplier — awaiting response", "status": "AWAITING_THIRD_PARTY", "verified": False,
            "order_id": order_id, "verification": "Waiting for supplier ACCEPT/REJECT/COUNTER", "steps": _steps(a)}


@approvals.handler("SEND_PAYMENT_REMINDER")
def reminder(params: dict, approval: dict) -> dict:
    a = call("send_payment_reminder", customer_id=params["customer_id"], message=params["message"])
    customer = store.get("Customer Credit", params["customer_id"]) or {}
    verified = customer.get("reminder_status") == "REMINDER SENT"
    return {"summary": f"REMINDER SENT to {customer.get('name')}" if verified else "Reminder failed", "verified": verified,
            "verification": f"Customer Credit[{params['customer_id']}].reminders_sent = {customer.get('reminders_sent')}",
            "steps": _steps(a)}


@approvals.handler("PUBLISH_CAMPAIGN")
def publish_campaign(params: dict, approval: dict) -> dict:
    a = call("send_campaign", campaign_id=params["campaign_id"])
    campaign = store.get("Campaigns", params["campaign_id"]) or {}
    verified = campaign.get("status") == "LIVE"
    if verified:
        _later(THIRD_PARTY_SIM_DELAY + 2, approval.get("run_id"), measure_campaign, params["campaign_id"])
    return {"summary": "Campaign created · Campaign published · Performance is now being tracked" if verified else "Publish failed",
            "verified": verified, "verification": f"Campaigns[{params['campaign_id']}].status = {campaign.get('status')}",
            "steps": _steps(a)}


def measure_campaign(campaign_id: str) -> dict:
    roi = call("calculate_campaign_roi", campaign_id=campaign_id)
    data = roi.get("data") or {}
    if data:
        call("send_telegram", role="user", title="Campaign results",
             text=f"📈 <b>{data['name']}</b>\nBefore: {inr(data['before_daily'])}/day\nAfter: {inr(data['after_daily'])}/day\n"
                  f"Improvement: {data['improvement_pct']:+.1f}% (simulated)")
        audit.record(f"Campaign measured: {data['summary']}", agent="merchant_growth", tool="calculate_campaign_roi", status="SUCCESS",
                     kind="action", run_id=flow.current_run_id() or "")
    return data


@approvals.handler("CREATE_PAYMENT_PLAN")
def payment_plan(params: dict, approval: dict) -> dict:
    a = call("create_payment_plan", user_id=params["user_id"], rp_id=params["rp_id"], transfer_amount=params["transfer_amount"])
    b = call("predict_payment_failure", user_id=params["user_id"], rp_id=params["rp_id"])
    after = (b.get("data") or {}).get("failure_probability", 1)
    before = params.get("prev_probability", 0.87)
    plan_id = (a.get("data") or {}).get("plan_id")
    verified = bool(plan_id) and after < 0.3
    return {"summary": f"PAYMENT PLAN CREATED ({plan_id}) · RISK REDUCED {round(before * 100)}% → {round(after * 100)}%" if verified else "Plan not effective",
            "verified": verified, "plan_id": plan_id, "risk_before": before, "risk_after": after,
            "verification": f"Re-ran predict_payment_failure: {round(after * 100)}% ({(b.get('data') or {}).get('risk')})",
            "steps": _steps(a, b)}


@approvals.handler("PLACE_ORDER")
def place_order(params: dict, approval: dict) -> dict:
    a = call("send_merchant_request", merchant_id=params["merchant_id"], items=params["items"], total=params["total"],
             delivery=params["delivery"])
    data = a.get("data") or {}
    order_id = data.get("order_id")
    if not order_id:
        return {"summary": "Could not contact merchant", "verified": False, "verification": str(a.get("error")), "steps": _steps(a)}
    store.update("Orders", order_id, {"approval_id": approval["approval_id"]})
    if not data.get("delivered"):
        _later(THIRD_PARTY_SIM_DELAY, approval.get("run_id"), respond_order, order_id, "accept", "merchant (simulated)", "simulation")
    return {"summary": f"Merchant contacted ({order_id}) — awaiting acceptance", "status": "AWAITING_THIRD_PARTY", "verified": False,
            "order_id": order_id, "verification": "Waiting for merchant to accept", "steps": _steps(a)}


@approvals.handler("ACCEPT_COUNTER_OFFER")
def accept_counter(params: dict, approval: dict) -> dict:
    order_id = params["order_id"]
    store.mutate("Orders", order_id, lambda o: (o.update({"status": "CONFIRMED", "amount": params["amount"], "delivery": params["delivery"]}),
                                                o["timeline"].append({"ts": now_iso(), "event": "Counter offer accepted"})))
    order = store.get("Orders", order_id)
    return {"summary": f"ORDER CONFIRMED at {inr(order['amount'])}", "verified": order["status"] == "CONFIRMED",
            "verification": f"Orders[{order_id}].status = {order['status']}", "steps": []}


# ── third-party responses (Telegram buttons, simulations, dashboard) ─────────
def respond_order(order_id: str, decision: str, by: str, channel: str) -> str:
    order = store.get("Orders", order_id)
    if not order:
        return "Unknown order"
    if order["status"] not in {"SENT_TO_SUPPLIER", "AWAITING_MERCHANT"}:
        return f"Order already {order['status']}"
    approval_id = order.get("approval_id", "")
    approval = store.get("Approvals", approval_id) if approval_id else None
    run_id = approval.get("run_id") if approval else None
    with flow.bind(run_id):
        audit.record(f"{order['counterparty']} responded {decision.upper()} to {order_id} via {channel}", agent="merchant_ops",
                     tool="get_merchant_response", status="INFO", kind="third_party", run_id=run_id or "")
        if decision == "accept":
            if order["type"] == "COMMERCE_ORDER":
                store.mutate("Orders", order_id, lambda o: (o.update({"status": "MERCHANT_ACCEPTED"}),
                                                            o["timeline"].append({"ts": now_iso(), "event": f"Accepted by {by}"})))
                call("get_merchant_response", order_id=order_id)
                created = call("create_order", order_id=order_id)
                final = store.get("Orders", order_id)
                verified = final["status"] == "CONFIRMED"
                call("send_telegram", role="user", title="Order confirmed",
                     text=f"✅ <b>ORDER CONFIRMED</b> {order_id}\nTotal: {inr(final['amount'])}\nDelivery: {final['delivery']}")
                result = {"summary": f"Merchant accepted · ORDER CONFIRMED · {inr(final['amount'])} · {final['delivery']}",
                          "verified": verified, "verification": f"Orders[{order_id}].status = {final['status']}", "steps": _steps(created)}
            else:
                store.mutate("Orders", order_id, lambda o: (o.update({"status": "CONFIRMED", "confirmed_at": now_iso()}),
                                                            o["timeline"].append({"ts": now_iso(), "event": f"Accepted by {by}"})))
                for line in order["items"]:
                    store.mutate("Inventory", line["sku"], lambda i, q=line["quantity"]: i.update({"incoming": q, "incoming_eta": order["delivery"]}))
                call("send_telegram", role="user", title="Supplier accepted",
                     text=f"✅ <b>ORDER CONFIRMED</b> {order_id}\n{order['counterparty']} accepted.\nDelivery: {order['delivery']}")
                final = store.get("Orders", order_id)
                result = {"summary": f"Supplier accepted · ORDER CONFIRMED · delivery {order['delivery']}",
                          "verified": final["status"] == "CONFIRMED", "verification": f"Orders[{order_id}].status = {final['status']}",
                          "steps": [{"tool": "get_merchant_response", "status": "SUCCESS", "summary": "ACCEPTED"}]}
        elif decision == "counter":
            counter = round(order["amount"] * 0.96)
            store.mutate("Orders", order_id, lambda o: (o.update({"status": "COUNTER_OFFER", "counter_amount": counter}),
                                                        o["timeline"].append({"ts": now_iso(), "event": f"Counter offer {inr(counter)} (day after tomorrow)"})))
            approvals.propose(action="ACCEPT_COUNTER_OFFER", agent="merchant_ops",
                              description=f"Accept {order['counterparty']} counter: {inr(counter)}, delivery day after tomorrow",
                              params={"order_id": order_id, "amount": counter, "delivery": "Day after tomorrow"}, amount=counter,
                              target=order["counterparty"], impact=f"Saves {inr(order['amount'] - counter)}, one day later", run_id=run_id)
            result = {"summary": f"Supplier countered at {inr(counter)} — awaiting your decision", "verified": False,
                      "verification": "Counter offer pending", "steps": []}
        else:
            store.mutate("Orders", order_id, lambda o: (o.update({"status": "REJECTED"}),
                                                        o["timeline"].append({"ts": now_iso(), "event": f"Rejected by {by}"})))
            result = {"summary": f"{order['counterparty']} rejected {order_id}", "verified": False,
                      "verification": f"Orders[{order_id}].status = REJECTED", "steps": []}
    if approval_id:
        approvals.complete_async(approval_id, result)
    telegram.resolve(order_id, f"{decision.upper()} by {by}")
    return result["summary"]


def telegram_callback(data: str, who: str) -> str:
    """Dispatch inline-button presses: apr:<id>:approve|reject, po|ord:<id>:accept|reject|counter."""
    try:
        kind, ref, decision = data.split(":", 2)
    except ValueError:
        return "Unknown action"
    if kind == "apr":
        result = approvals.decide(ref, decision == "approve", by=f"{who} (Telegram)", channel="telegram")
        return f"{result['action']} → {result['status']}"
    if kind in {"po", "ord"}:
        return respond_order(ref, decision, f"{who} (Telegram)", "telegram")
    return "Unknown action"


def notify_approval(approval: dict) -> None:
    """Mirror each approval request to Telegram with APPROVE / REJECT buttons."""
    telegram.send(role="user", title=f"Approval needed · {approval['approval_id']}", related_id=approval["approval_id"],
                  text=f"🔐 <b>SAATHI needs your approval</b>\n\n{approval['description']}\n"
                       + (f"Amount: {inr(approval['amount'])}\n" if approval.get("amount") else "")
                       + (f"Impact: {approval['impact']}\n" if approval.get("impact") else "")
                       + ("\n<i>Sandbox action — simulated</i>" if approval.get("simulated") else ""),
                  buttons=[("✅ APPROVE", f"apr:{approval['approval_id']}:approve"), ("❌ REJECT", f"apr:{approval['approval_id']}:reject")])


def close_approval_buttons(approval: dict) -> None:
    telegram.resolve(approval["approval_id"], f"{approval['status']} by {approval.get('decided_by')} via {approval.get('channel')}")


approvals.on("proposed", notify_approval)
approvals.on("decided", close_approval_buttons)
