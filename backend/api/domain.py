"""Domain endpoints. State-changing endpoints never execute directly: they return
a PENDING approval that must be approved via /api/approvals/{id}/approve."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.agents import commerce, financial_safety, merchant_growth, merchant_ops, money_sos, payment_reliability
from backend.agents.base import CONSUMER_ID, MERCHANT_USER_ID, AgentResult, Proposal
from backend.models.schemas import (CampaignRef, ClaimRequest, CommerceIntent, CommerceOrder, InventoryRequest, OrderRequest,
                                    PaymentRequest, ReminderRequest, RiskRequest, SOSRequest, TxnIn, TxnRef)
from backend.services import approvals, calls
from backend.services.store import store
from backend.tools.registry import ToolError, call, ok
from backend.utils.helpers import inr

router = APIRouter(prefix="/api")


def _result(res: AgentResult) -> dict:
    created = [approvals.propose(action=p.action, description=p.description, agent=res.agent, params=p.params, amount=p.amount,
                                 impact=p.impact, target=p.target, reason=p.reason, user_id=res.user_id) for p in res.proposals]
    return {"agent": res.agent, "headline": res.headline, "findings": res.findings, "decision": res.decision,
            "data": [{"label": k, "value": v} for k, v in res.data], "reply": res.reply("en"),
            "approvals": [approvals.as_card(a) for a in created]}


def _propose(res_agent: str, prop: Proposal, user_id: str) -> dict:
    a = approvals.propose(action=prop.action, description=prop.description, agent=res_agent, params=prop.params, amount=prop.amount,
                          impact=prop.impact, target=prop.target, reason=prop.reason, user_id=user_id)
    return {"approval": approvals.as_card(a), "note": "Approve via POST /api/approvals/{id}/approve"}


def _guard(fn):
    try:
        return fn()
    except ToolError as exc:
        raise HTTPException(422, str(exc))


# ── fraud ──
@router.post("/risk/analyze")
def risk_analyze(req: RiskRequest) -> dict:
    """Analyze an existing txn, or inject a new one (defaults to the demo fraud attempt) and run the full flow."""
    if req.txn_id:
        return _guard(lambda: _result(financial_safety.assess(req.txn_id)))
    t = req.transaction or TxnIn()
    txn = financial_safety.inject_suspicious_transaction(user_id=t.user_id, amount=t.amount, time=t.time, recipient=t.recipient,
                                                         recipient_id=t.recipient_id)
    return calls.start_fraud_flow(txn["txn_id"])


@router.post("/fraud/freeze")
def fraud_freeze(req: TxnRef) -> dict:
    txn = store.get("Transactions", req.txn_id)
    if not txn:
        raise HTTPException(404, "transaction not found")
    return _propose("financial_safety", financial_safety.fraud_proposal(txn, {"risk_score": txn.get("risk_score") or 0,
                                                                              "factors": [{"detail": "Manual request"}]}), txn["user_id"])


@router.post("/fraud/case")
def fraud_case(req: TxnRef) -> dict:
    return fraud_freeze(req)


# ── money sos ──
@router.post("/money-sos/analyze")
def sos_analyze(req: SOSRequest) -> dict:
    return _guard(lambda: _result(money_sos.handle("money_sos", {"amount": req.amount, "purpose": req.purpose}, req.user_id)))


@router.post("/money-sos/claim")
def sos_claim(req: ClaimRequest) -> dict:
    return _propose("money_sos", Proposal(action="CREATE_INSURANCE_CLAIM", description=f"File insurance claim for {inr(req.amount)}",
                                          params={"user_id": req.user_id, "amount": req.amount, "reason": req.reason}, amount=req.amount),
                    req.user_id)


# ── merchant ──
@router.post("/merchant/analyze")
def merchant_analyze() -> dict:
    return _guard(lambda: _result(merchant_growth.handle("business_health", {}, MERCHANT_USER_ID)))


@router.post("/merchant/reconcile")
def merchant_reconcile() -> dict:
    return _guard(lambda: _result(merchant_ops.handle("cash_reconcile", {}, MERCHANT_USER_ID)))


@router.post("/merchant/inventory")
def merchant_inventory(req: InventoryRequest | None = None) -> dict:
    item = req.item if req else None
    return _guard(lambda: {**ok(call("check_inventory", item=item))})


@router.post("/merchant/order")
def merchant_order(req: OrderRequest) -> dict:
    plan = _guard(lambda: ok(call("calculate_reorder", sku=req.sku)))
    qty = req.quantity or plan["recommended_qty"]
    return _propose("merchant_ops", Proposal(action="CREATE_PURCHASE_ORDER", description=f"Order {qty:g} {plan['unit']} {plan['item']} from {plan['supplier']}",
                                             params={"sku": req.sku, "quantity": qty, "supplier_id": plan["supplier_id"]},
                                             amount=qty * plan["unit_cost"], target=plan["supplier"]), MERCHANT_USER_ID)


@router.post("/customer/reminder")
def customer_reminder(req: ReminderRequest) -> dict:
    return _guard(lambda: _result(merchant_ops.handle("customer_reminder", {"customer_name": req.customer_name}, MERCHANT_USER_ID)))


@router.post("/campaign/create")
def campaign_create() -> dict:
    return _guard(lambda: _result(merchant_growth.handle("growth_campaign", {}, MERCHANT_USER_ID)))


@router.post("/campaign/publish")
def campaign_publish(req: CampaignRef) -> dict:
    campaign = store.get("Campaigns", req.campaign_id)
    if not campaign:
        raise HTTPException(404, "campaign not found")
    return _propose("merchant_growth", Proposal(action="PUBLISH_CAMPAIGN", description=f"Publish '{campaign['name']}'",
                                                params={"campaign_id": req.campaign_id}), MERCHANT_USER_ID)


@router.post("/campaign/{campaign_id}/measure")
def campaign_measure(campaign_id: str) -> dict:
    return call("calculate_campaign_roi", campaign_id=campaign_id)


# ── commerce ──
@router.post("/commerce/intent")
def commerce_intent(req: CommerceIntent) -> dict:
    return _guard(lambda: _result(commerce.handle("purchase_request", {}, CONSUMER_ID, text=req.text)))


@router.post("/commerce/order")
def commerce_order(req: CommerceOrder) -> dict:
    return _propose("commerce", Proposal(action="PLACE_ORDER", description=f"Place order with {req.merchant_id} for {inr(req.total)}",
                                         params=req.model_dump(), amount=req.total), CONSUMER_ID)


# ── payment reliability ──
@router.post("/payment/predict")
def payment_predict(req: PaymentRequest) -> dict:
    if req.rp_id:
        return call("predict_payment_failure", user_id=req.user_id, rp_id=req.rp_id)
    res = _guard(lambda: payment_reliability.handle("payment_risk", {}, req.user_id))
    return {"headline": res.headline, "data": [{"label": k, "value": v} for k, v in res.data], "facts": res.facts,
            "proposal": res.proposals[0].__dict__ if res.proposals else None}


@router.post("/payment/plan")
def payment_plan(req: PaymentRequest) -> dict:
    res = _guard(lambda: payment_reliability.handle("payment_risk", {}, req.user_id))
    if not res.proposals:
        return {"note": "No payment at risk — no plan needed"}
    return _propose("payment_reliability", res.proposals[0], req.user_id)
