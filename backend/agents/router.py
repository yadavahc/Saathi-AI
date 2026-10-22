"""Intelligent routing — Claude decides intent, agent, entities, risk; rules are the fallback."""
from __future__ import annotations

import re

from backend.integrations.claude_client import claude
from backend.services.store import store

INTENTS = {
    "fraud_check": "financial_safety",
    "money_sos": "money_sos",
    "financial_summary": "money_sos",
    "business_health": "merchant_growth",
    "growth_campaign": "merchant_growth",
    "campaign_roi": "merchant_growth",
    "cash_reconcile": "merchant_ops",
    "inventory_check": "merchant_ops",
    "customer_reminder": "merchant_ops",
    "payment_risk": "payment_reliability",
    "purchase_request": "commerce",
    "general": "none",
}
MERCHANT_INTENTS = {"business_health", "growth_campaign", "campaign_roi", "cash_reconcile", "inventory_check", "customer_reminder"}
LANGS = ["en", "hi", "kn", "ta", "te", "mr", "bn", "hinglish", "kanglish", "other"]

_nullable = lambda t: {"type": [t, "null"]}  # noqa: E731

ROUTE_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["language", "intents", "risk_level", "requires_confirmation", "reasoning"],
    "properties": {
        "language": {"type": "string", "enum": LANGS},
        "intents": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["intent", "confidence", "entities"],
                "properties": {
                    "intent": {"type": "string", "enum": list(INTENTS)},
                    "confidence": {"type": "number"},
                    "entities": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["amount", "purpose", "customer_name", "item", "items", "budget", "deadline"],
                        "properties": {
                            "amount": _nullable("number"),
                            "purpose": _nullable("string"),
                            "customer_name": _nullable("string"),
                            "item": _nullable("string"),
                            "items": {"type": "array", "items": {"type": "object", "additionalProperties": False,
                                                                 "required": ["name", "quantity"],
                                                                 "properties": {"name": {"type": "string"}, "quantity": {"type": "integer"}}}},
                            "budget": _nullable("number"),
                            "deadline": _nullable("string"),
                        },
                    },
                },
            },
        },
        "risk_level": {"type": "string", "enum": ["LOW", "MEDIUM", "HIGH"]},
        "requires_confirmation": {"type": "boolean"},
        "reasoning": {"type": "string"},
    },
}

SYSTEM = """You are the routing brain of SAATHI AI, a multilingual financial & business action agent for Indian users and small merchants.
Classify the user's message (it may be English, Hindi, Kannada, Tamil, Telugu, Marathi, Bengali, or code-mixed Hinglish/Kanglish, in any script).

Intents:
- fraud_check: suspicious/unknown transaction, scam, "block my payment"
- money_sos: urgent need for money (extract amount; purpose like medical/hospital/education/rent if stated or implied by context)
- financial_summary: savings/balance/insurance overview
- payment_risk: upcoming EMI/AutoPay/subscription might fail, bills due, balance enough?
- business_health: how is my business/shop today, daily summary (e.g. "aaj business hegide", "business kaisa hai")
- growth_campaign: sales falling, slow evenings, want a promotion/offer/campaign
- campaign_roi: did the campaign/offer work
- cash_reconcile: cash mismatch, galla, reconcile cash
- inventory_check: stock low/finished, reorder (e.g. rice "khatam", "mugidide", "stock illa")
- customer_reminder: send a payment reminder to a customer who owes money (extract customer_name; "Ramesh ge reminder kalisu")
- purchase_request: buy items (extract items with quantities, budget, deadline like tomorrow)
- general: greetings or anything else
A message can contain several intents (e.g. "sales are down and rice is finishing" → growth_campaign + inventory_check). Order them by urgency.
language: the language/style the user wrote in. Use "kanglish" for Kannada written in Latin script or mixed with English, "hinglish" likewise for Hindi.
Use the conversation context to fill missing entities (e.g. an amount mentioned in the previous turn).
risk_level reflects money at stake / fraud risk. requires_confirmation is true if the likely next step changes money, orders or messages.
Never request OTP, PIN, CVV or passwords. Amounts are in rupees as plain numbers."""

# ── rule-based fallback ──────────────────────────────────────────────────────
KANNADA_WORDS = {"nanna", "nimma", "hegide", "kalisu", "maadi", "maadla", "ide", "beku", "illa", "howdu", "houdu", "ge", "aaytu",
                 "enu", "mugidide", "ivattu", "naale", "kodi", "sari", "beda", "yaake", "hege", "aagide"}
HINDI_WORDS = {"kya", "hai", "mera", "meri", "mujhe", "chahiye", "kaisa", "bhejo", "karo", "nahi", "haan", "paisa", "aaj",
               "kal", "kitna", "hua", "raha", "khatam", "jaldi", "turant"}
TAMIL_WORDS = {"enna", "eppadi", "irukku", "anuppu", "venum", "illai", "aamam", "panam"}
TELUGU_WORDS = {"ela", "undi", "pampu", "kavali", "ledu", "avunu", "dabbu"}

RULES = [
    ("fraud_check", r"fraud|suspicious|scam|didn'?t make|not me|unknown (payment|transaction)|block (the|my|this)? ?(payment|transaction)"),
    ("customer_reminder", r"remind|reminder|kalisu|yaad dila|udhaar|baaki"),
    ("purchase_request", r"\b\d+\s+(notebooks?|pens?|books?|pencils?|boxes|items|kg\b)|\bbuy\b|order .* (under|tomorrow)"),
    ("money_sos", r"urgent|emergency|turant|jaldi|need\s*(₹|rs\.?|inr)?\s*[\d,]+|hospital|medical"),
    ("payment_risk", r"autopay|auto pay|emi|mandate|payment (fail|bounce)|bill due|subscription"),
    ("cash_reconcile", r"cash|reconcile|galla|variance"),
    ("inventory_check", r"stock|inventory|rice|khatam|mugid|reorder|out of"),
    ("growth_campaign", r"sales (are )?(down|drop|fall)|decline|promotion|campaign|offer|evening|slow"),
    ("campaign_roi", r"(campaign|offer).*(work|result|roi)"),
    ("business_health", r"business|dhanda|vyapar|vyapara|sales today|how.*shop|hegide|kaisa"),
    ("financial_summary", r"balance|savings|insurance|summary"),
]


def detect_language(text: str) -> str:
    if re.search(r"[ಀ-೿]", text):
        return "kn"
    if re.search(r"[஀-௿]", text):
        return "ta"
    if re.search(r"[ఀ-౿]", text):
        return "te"
    if re.search(r"[ঀ-৿]", text):
        return "bn"
    if re.search(r"[ऀ-ॿ]", text):
        return "hi"
    words = set(re.findall(r"[a-z]+", text.lower()))
    scores = {"kanglish": len(words & KANNADA_WORDS) * 1.2, "hinglish": len(words & HINDI_WORDS),
              "ta": len(words & TAMIL_WORDS), "te": len(words & TELUGU_WORDS)}
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "en"


def _amount(text: str) -> float | None:
    t = text.lower().replace(",", "")
    m = re.search(r"(?:₹|rs\.?|inr)\s*(\d+(?:\.\d+)?)\s*(k|lakh|thousand)?", t) or re.search(r"(\d+(?:\.\d+)?)\s*(k|lakh|thousand|rupees)", t)
    if not m:
        return None
    value = float(m.group(1))
    unit = m.group(2) or ""
    return value * (1000 if unit in {"k", "thousand"} else 100000 if unit == "lakh" else 1)


def rule_route(text: str, context: dict | None = None) -> dict:
    lowered = text.lower()
    found = []
    for intent, pattern in RULES:
        if re.search(pattern, lowered) and intent not in found:
            found.append(intent)
    if "purchase_request" in found:
        found = [i for i in found if i not in {"money_sos", "inventory_check"}]
    if "business_health" in found and len(found) > 1 and not re.search(r"hegide|kaisa|how", lowered):
        found.remove("business_health")
    if "fraud_check" in found and "money_sos" in found:
        found.remove("money_sos")
    context = context or {}
    if not found and context.get("last_intent") == "money_sos":
        found = ["money_sos"]
    if not found:
        found = ["general"]
    names = {c["name"].lower(): c["name"] for c in store.all("Customer Credit")}
    customer = next((names[w] for w in re.findall(r"[a-z]+", lowered) if w in names), None)
    purpose = next((w for w in ("hospital", "medical", "surgery", "accident", "education", "rent") if w in lowered), None)
    amount = _amount(text) if "purchase_request" not in found else None
    if amount is None and "money_sos" in found:
        amount = context.get("amount")
    item = next((w for w in ("rice", "sugar", "dal", "oil", "milk", "tea") if w in lowered), None)
    entities = {"amount": amount, "purpose": purpose or context.get("purpose"), "customer_name": customer, "item": item, "items": [],
                "budget": None, "deadline": None}
    risky = {"fraud_check", "money_sos", "payment_risk"}
    return {
        "language": detect_language(text),
        "intents": [{"intent": i, "confidence": 0.7, "entities": entities} for i in found[:3]],
        "risk_level": "HIGH" if found[0] in risky else "MEDIUM" if found[0] != "general" else "LOW",
        "requires_confirmation": found[0] != "general",
        "reasoning": "Keyword routing (Claude unavailable)",
        "engine": "rules",
    }


def route(text: str, persona: str = "auto", context: dict | None = None) -> dict:
    history = (context or {}).get("history", [])
    prompt = (
        (f"Conversation so far:\n" + "\n".join(f"{h['role']}: {h['text']}" for h in history[-4:]) + "\n\n" if history else "")
        + f"User persona: {persona}\nUser message: {text}"
    )
    decision = claude.structured(system=SYSTEM, prompt=prompt, schema=ROUTE_SCHEMA, effort="low")
    if not decision or not decision.get("intents"):
        return rule_route(text, context)
    decision["engine"] = "claude"
    # backfill entities Claude may have left empty but context knows
    for item in decision["intents"]:
        if item["intent"] == "money_sos" and not item["entities"].get("amount") and context:
            item["entities"]["amount"] = context.get("amount")
    if decision["language"] == "other":
        decision["language"] = detect_language(text)
    return decision


def agent_for(intent: str) -> str:
    return INTENTS.get(intent, "none")
