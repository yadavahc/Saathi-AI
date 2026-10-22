"""Shared agent types."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

AGENT_INFO = {
    "financial_safety": {"name": "Financial Safety Agent", "icon": "shield",
                         "purpose": "Protects users from suspicious or risky financial activity.",
                         "tools": ["get_transaction", "calculate_transaction_risk", "verify_recipient", "calculate_payment_risk",
                                   "freeze_transaction", "create_fraud_case", "send_fraud_alert"]},
    "money_sos": {"name": "Money SOS Agent", "icon": "siren",
                  "purpose": "Helps users handle urgent financial situations safely.",
                  "tools": ["get_financial_summary", "get_insurance_details", "get_upcoming_payments", "find_funding_options",
                            "create_insurance_claim"]},
    "merchant_ops": {"name": "Merchant Operations Agent", "icon": "store",
                     "purpose": "Runs day-to-day operations: cash, inventory, suppliers, customer credit.",
                     "tools": ["get_sales_summary", "get_expenses", "get_cash_records", "reconcile_cash", "check_inventory",
                               "calculate_reorder", "create_purchase_order", "get_customer_credit", "send_payment_reminder"]},
    "merchant_growth": {"name": "Merchant Growth Agent", "icon": "trending",
                        "purpose": "Finds and acts on opportunities to grow the business.",
                        "tools": ["analyze_sales", "identify_growth_opportunity", "identify_customer_churn", "generate_campaign",
                                  "send_campaign", "calculate_campaign_roi", "calculate_business_health", "generate_next_best_action"]},
    "payment_reliability": {"name": "Payment Reliability Agent", "icon": "radar",
                            "purpose": "Predicts payment failures before they happen and plans for them.",
                            "tools": ["get_upcoming_payments", "get_balance_history", "get_recurring_payments", "predict_payment_failure",
                                      "calculate_payment_shortfall", "find_upcoming_income", "create_payment_plan", "send_payment_reminder"]},
    "commerce": {"name": "Commerce Agent", "icon": "cart",
                 "purpose": "Buys things from natural-language requests: find, compare, contact, order.",
                 "tools": ["parse_purchase_intent", "find_merchants", "compare_prices", "check_availability", "send_merchant_request",
                           "get_merchant_response", "create_order"]},
}

CONSUMER_ID = "U001"
MERCHANT_USER_ID = "M001"


@dataclass
class Proposal:
    action: str
    description: str
    params: dict
    amount: float | None = None
    impact: str = ""
    target: str = ""
    reason: str = ""
    simulated: bool = True


@dataclass
class AgentResult:
    agent: str
    intent: str
    headline: str = ""
    findings: list[str] = field(default_factory=list)
    data: list[tuple[str, Any]] = field(default_factory=list)
    decision: str = ""
    proposals: list[Proposal] = field(default_factory=list)
    facts: dict = field(default_factory=dict)
    replies: dict[str, str] = field(default_factory=dict)  # en / hi (Hinglish) / kn (Kanglish)
    user_id: str = CONSUMER_ID
    priority: int = 1

    def reply(self, style: str) -> str:
        return self.replies.get(style) or self.replies.get("en") or self.headline


def style_for(language: str) -> str:
    """Map detected language to a fallback-template style."""
    if language in {"kn", "kanglish"}:
        return "kn"
    if language in {"hi", "hinglish"}:
        return "hi"
    return "en"


def tts_code(language: str) -> str:
    return {"kn": "kn-IN", "kanglish": "kn-IN", "hi": "hi-IN", "hinglish": "hi-IN", "ta": "ta-IN", "te": "te-IN",
            "mr": "mr-IN", "bn": "bn-IN"}.get(language, "en-IN")
