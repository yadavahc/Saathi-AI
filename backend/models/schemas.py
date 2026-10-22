"""Pydantic request models."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Persona = Literal["auto", "consumer", "merchant"]


class ChatRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    persona: Persona = "auto"
    language: str = "auto"
    speak: bool = False


class DecisionRequest(BaseModel):
    by: str = "user"
    channel: str = "dashboard"


class CallResponse(BaseModel):
    text: str = Field(min_length=1, max_length=500)


class TxnIn(BaseModel):
    user_id: str = "U001"
    amount: float = Field(25000, gt=0)
    time: str = Field("23:47", pattern=r"^\d{2}:\d{2}$")
    recipient: str = "QuickCash Rewards"
    recipient_id: str = "quickcash.rewards@ybl"


class RiskRequest(BaseModel):
    txn_id: str | None = None
    transaction: TxnIn | None = None


class TxnRef(BaseModel):
    txn_id: str


class SOSRequest(BaseModel):
    amount: float = Field(gt=0)
    purpose: str = "unknown"
    user_id: str = "U001"


class ClaimRequest(BaseModel):
    amount: float = Field(gt=0)
    reason: str = "Hospital admission — emergency"
    user_id: str = "U001"


class InventoryRequest(BaseModel):
    item: str | None = None


class OrderRequest(BaseModel):
    sku: str = "SKU-RICE"
    quantity: float | None = None


class ReminderRequest(BaseModel):
    customer_name: str = "Ramesh"


class CampaignRef(BaseModel):
    campaign_id: str


class CommerceIntent(BaseModel):
    text: str = Field(min_length=3, max_length=500)


class CommerceOrder(BaseModel):
    merchant_id: str
    items: list[dict]
    total: float
    delivery: str


class PaymentRequest(BaseModel):
    user_id: str = "U001"
    rp_id: str | None = None


class DemoStart(BaseModel):
    mode: Literal["autoplay", "presenter"] = "autoplay"
    scenario: int | None = Field(None, ge=1, le=8)


class SimulateResponse(BaseModel):
    data: str
    who: str = "Dashboard (simulated)"


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2400)
    language_code: str = "kn-IN"
