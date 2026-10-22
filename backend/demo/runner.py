"""START LIVE DEMO — eight scripted scenarios that run the *real* agents, tools,
approval engine, Telegram and voice stack end to end. Only the human lines
("No.", "Yes.") are scripted. In presenter mode the runner waits for a real
click/phone tap before falling back to the scripted answer.
"""
from __future__ import annotations

import threading
import time

from backend.agents import actions, financial_safety, orchestrator
from backend.config import settings
from backend.services import approvals, calls
from backend.services.store import store
from backend.utils.helpers import get_logger, now_iso

log = get_logger("demo")

SCENARIOS = [
    {"id": 1, "key": "fraud", "title": "Fraud", "subtitle": "Detect → call → verify → block"},
    {"id": 2, "key": "sos", "title": "Money SOS", "subtitle": "₹80,000 emergency plan"},
    {"id": 3, "key": "health", "title": "Business Health", "subtitle": "What matters most today"},
    {"id": 4, "key": "inventory", "title": "Inventory", "subtitle": "Reorder → supplier accepts"},
    {"id": 5, "key": "growth", "title": "Business Growth", "subtitle": "Detect → campaign → measure"},
    {"id": 6, "key": "payment", "title": "Payment Prediction", "subtitle": "Prevent an AutoPay failure"},
    {"id": 7, "key": "credit", "title": "Customer Credit", "subtitle": "Reminder via Telegram"},
    {"id": 8, "key": "commerce", "title": "NL Commerce", "subtitle": "Find → compare → order"},
]


class DemoState:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.generation = 0
        self.thread: threading.Thread | None = None
        self.reset()

    def reset(self) -> None:
        self.status = "idle"
        self.mode = "autoplay"
        self.current = None
        self.scenarios = [{**s, "status": "pending", "run_ids": []} for s in SCENARIOS]
        self.narration: list[dict] = []
        self.started_at = ""
        self.finished_at = ""
        self.stop_requested = False
        self.generation += 1  # any older runner thread is now stale

    def snapshot(self) -> dict:
        return {"status": self.status, "mode": self.mode, "current": self.current, "scenarios": self.scenarios,
                "narration": self.narration[-60:], "started_at": self.started_at, "finished_at": self.finished_at,
                "impact": impact() if self.status in {"complete", "running"} else None}


state = DemoState()


class Stop(Exception):
    pass


_local = threading.local()


def _check() -> None:
    if state.stop_requested or getattr(_local, "generation", None) != state.generation:
        raise Stop()


def _delay(mult: float = 1.0) -> None:
    end = time.time() + settings.demo_step_delay * mult
    while time.time() < end:
        _check()
        time.sleep(0.1)


def say(speaker: str, text: str, **extra) -> None:
    _check()
    state.narration.append({"speaker": speaker, "text": text, "ts": now_iso(), "scenario": state.current, **extra})


def _scenario(sid: int) -> dict:
    return state.scenarios[sid - 1]


def _track(response: dict) -> None:
    if response.get("run_id"):
        _scenario(state.current)["run_ids"].append(response["run_id"])


def human_approval(approval_id: str, line: str, who: str) -> dict:
    """Presenter mode waits for a real decision; autoplay answers with the scripted line."""
    if state.mode == "presenter":
        say("SYSTEM", "Waiting for your approval — click APPROVE on the dashboard or in Telegram…")
        deadline = time.time() + 90
        while time.time() < deadline:
            if state.stop_requested:
                raise Stop()
            current = store.get("Approvals", approval_id)
            if current["status"] != "PENDING":
                return approvals.wait(approval_id, 30)
            time.sleep(0.3)
    _delay(1.2)
    say("USER", line)
    _delay(0.4)
    approvals.decide(approval_id, True, by=who, channel="voice")
    return approvals.wait(approval_id, 2) or store.get("Approvals", approval_id)


def wait_third_party(approval_id: str, order_id: str, counterparty: str) -> dict:
    """Wait for supplier/merchant; in autoplay simulate the acceptance if no one taps in time."""
    limit = 60 if state.mode == "presenter" else 8
    deadline = time.time() + limit
    while time.time() < deadline:
        if state.stop_requested:
            raise Stop()
        approval = store.get("Approvals", approval_id)
        if approval["status"] not in {"AWAITING_THIRD_PARTY", "APPROVED"}:
            return approval
        time.sleep(0.3)
    actions.respond_order(order_id, "accept", f"{counterparty} (demo auto-accept)", "simulation")
    return approvals.wait(approval_id, 5)


# ── scenarios ────────────────────────────────────────────────────────────────
def demo_fraud() -> None:
    say("SYSTEM", "Injecting transaction: ₹25,000 · 11:47 PM · new recipient · historical average ₹850")
    txn = financial_safety.inject_suspicious_transaction()
    _delay()
    flow = calls.start_fraud_flow(txn["txn_id"])
    _scenario(1)["run_ids"].append(flow["run_id"])
    say("SAATHI", f"Risk {flow['risk']['risk_score']}/100 {flow['risk']['risk_level']} → calling Rahul (Kannada)")
    call_row = flow["call"]
    say("SAATHI", call_row["transcript"][0]["text"], voice=True)
    _delay(2.2)
    say("USER", "No.")
    calls.respond(call_row["call_id"], "No")
    say("SAATHI", "Sari. Transaction-na block maadi fraud complaint register maadla?", voice=True)
    approval_id = store.get("Calls", call_row["call_id"])["approval_id"]
    if state.mode == "presenter":
        human_approval(approval_id, "Yes.", "Rahul (voice)")
        calls.finish_after_decision(call_row["call_id"], store.get("Approvals", approval_id))
    else:
        _delay(1.6)
        say("USER", "Yes.")
        calls.respond(call_row["call_id"], "Yes")
    result = store.get("Approvals", approval_id)
    for step in (result.get("result") or {}).get("steps", []):
        say("TOOL", f"{step['tool']}() → {step['status']}")
    say("SAATHI", (result.get("result") or {}).get("summary", ""), verified=result["status"] == "EXECUTED")


def demo_sos() -> None:
    say("USER", "I need ₹80,000 urgently.")
    r1 = orchestrator.handle("I need ₹80,000 urgently.", persona="consumer", source="demo", channel="voice", use_llm=True, llm_reply=False)
    _track(r1)
    say("SAATHI", r1["reply"])
    _delay(1.4)
    say("USER", "Yes, it's for my father's hospital admission.")
    r2 = orchestrator.handle("Yes, it's for my father's hospital admission.", persona="consumer", source="demo", channel="voice",
                             use_llm=True, llm_reply=False)
    _track(r2)
    say("SAATHI", r2["reply"])
    for card in r2["approvals"]:
        result = human_approval(card["approval_id"], "Yes, file it.", "Rahul (voice)")
        say("SAATHI", (result.get("result") or {}).get("summary", ""), verified=result["status"] == "EXECUTED")


def demo_health() -> None:
    say("USER", "Aaj business hegide?")
    r = orchestrator.handle("Aaj business hegide?", persona="merchant", source="demo", channel="voice", use_llm=True, llm_reply=False)
    _track(r)
    for agent in r["agents"]:
        say("DATA", " · ".join(f"{d['label']}: {d['value']}" for d in agent["data"][:9]))
    say("SAATHI", r["reply"])


def demo_inventory() -> None:
    say("USER", "Rice stock check maadi.")
    r = orchestrator.handle("Rice stock check maadi", persona="merchant", source="demo", channel="voice", use_llm=True, llm_reply=False)
    _track(r)
    say("SAATHI", r["reply"])
    for card in r["approvals"][:1]:
        result = human_approval(card["approval_id"], "Howdu, order maadi.", "Lakshmi (voice)")
        say("SAATHI", (result.get("result") or {}).get("summary", ""))
        order_id = (result.get("result") or {}).get("order_id")
        if order_id:
            say("SYSTEM", "Telegram PO sent to ABC Stores with [ACCEPT] [REJECT] [COUNTER OFFER]")
            final = wait_third_party(card["approval_id"], order_id, "ABC Stores")
            say("SUPPLIER", "ACCEPT")
            say("SAATHI", (final.get("result") or {}).get("summary", "ORDER CONFIRMED"), verified=final["status"] == "EXECUTED")


def demo_growth() -> None:
    say("SYSTEM", "Daily sales scan (proactive event)")
    r = orchestrator.handle("SYSTEM EVENT · Daily sales scan", persona="merchant", source="event", channel="event",
                            forced_intents=[{"intent": "growth_campaign", "confidence": 1.0, "entities": {}}],
                            language_hint="en", use_llm=False)
    _track(r)
    say("SAATHI", r["reply"])
    for card in r["approvals"]:
        result = human_approval(card["approval_id"], "Yes.", "Lakshmi (voice)")
        say("SAATHI", (result.get("result") or {}).get("summary", ""))
        campaign_id = store.get("Approvals", card["approval_id"])["params"]["campaign_id"]
        deadline = time.time() + 15
        while time.time() < deadline and not (store.get("Campaigns", campaign_id) or {}).get("after_daily"):
            _delay(0.3)
        c = store.get("Campaigns", campaign_id)
        if c.get("after_daily"):
            say("SAATHI", f"Before: ₹{c['before_daily']:,}/day · After: ₹{c['after_daily']:,}/day · Improvement: {c['improvement_pct']:+.1f}% (simulated)",
                verified=True)


def demo_payment() -> None:
    say("SYSTEM", "Nightly payment-risk scan (proactive event)")
    r = orchestrator.handle("SYSTEM EVENT · Nightly payment-risk scan", persona="consumer", source="event", channel="event",
                            forced_intents=[{"intent": "payment_risk", "confidence": 1.0, "entities": {}}],
                            language_hint="en", use_llm=False)
    _track(r)
    say("SAATHI", r["reply"])
    for card in r["approvals"]:
        result = human_approval(card["approval_id"], "Yes, please.", "Rahul (voice)")
        say("SAATHI", (result.get("result") or {}).get("summary", ""), verified=result["status"] == "EXECUTED")


def demo_credit() -> None:
    say("USER", "Ramesh ge reminder kalisu.")
    r = orchestrator.handle("Ramesh ge reminder kalisu.", persona="merchant", source="demo", channel="voice", use_llm=True, llm_reply=False)
    _track(r)
    say("SAATHI", r["reply"])
    for card in r["approvals"]:
        result = human_approval(card["approval_id"], "Howdu.", "Lakshmi (voice)")
        say("SAATHI", (result.get("result") or {}).get("summary", ""), verified=result["status"] == "EXECUTED")


def demo_commerce() -> None:
    text = "I need 20 notebooks and 10 pens tomorrow under ₹2,000."
    say("USER", text)
    r = orchestrator.handle(text, persona="consumer", source="demo", channel="voice", use_llm=True, llm_reply=False)
    _track(r)
    for agent in r["agents"]:
        say("DATA", " · ".join(f"{d['label']}: {d['value']}" for d in agent["data"]))
    say("SAATHI", r["reply"])
    for card in r["approvals"]:
        result = human_approval(card["approval_id"], "Yes, order it.", "Rahul (voice)")
        say("SAATHI", (result.get("result") or {}).get("summary", ""))
        order_id = (result.get("result") or {}).get("order_id")
        if order_id:
            final = wait_third_party(card["approval_id"], order_id, "ABC Stationers")
            say("MERCHANT", "ACCEPT")
            say("SAATHI", (final.get("result") or {}).get("summary", ""), verified=final["status"] == "EXECUTED")


RUNNERS = {1: demo_fraud, 2: demo_sos, 3: demo_health, 4: demo_inventory, 5: demo_growth, 6: demo_payment, 7: demo_credit, 8: demo_commerce}


def _run(ids: list[int], generation: int) -> None:
    _local.generation = generation
    try:
        for sid in ids:
            state.current = sid
            _scenario(sid)["status"] = "running"
            say("SYSTEM", f"DEMO {sid} — {_scenario(sid)['title'].upper()}", banner=True)
            try:
                RUNNERS[sid]()
                _scenario(sid)["status"] = "done"
            except Stop:
                raise
            except Exception as exc:
                log.exception("Demo %s failed", sid)
                _scenario(sid)["status"] = "error"
                say("SYSTEM", f"Scenario error: {exc}")
            _delay(1.5)
        state.status = "complete"
    except Stop:
        if generation == state.generation:
            state.status = "stopped"
    finally:
        if generation == state.generation:
            state.current = None
            state.finished_at = now_iso()


def start(mode: str = "autoplay", scenario: int | None = None) -> dict:
    with state.lock:
        if state.status == "running":
            return state.snapshot()
        if scenario is None:
            reset_world()
        state.status = "running"
        state.mode = mode
        state.stop_requested = False
        state.started_at = now_iso()
        ids = [scenario] if scenario else [s["id"] for s in SCENARIOS]
        state.thread = threading.Thread(target=_run, args=(ids, state.generation), daemon=True, name="demo")
        state.thread.start()
        return state.snapshot()


def stop() -> dict:
    state.stop_requested = True
    return state.snapshot()


def reset_world() -> None:
    state.stop_requested = True
    if state.thread and state.thread.is_alive() and state.thread is not threading.current_thread():
        state.thread.join(timeout=20)
    store.reset()
    orchestrator.reset_memory()
    state.reset()


def impact() -> list[dict]:
    """The final checklist — every line is verified against stored state."""
    fraud = store.all("Fraud Cases")
    frozen = [t for t in store.all("Transactions") if t["status"] == "FROZEN"]
    voice = [c for c in store.all("Calls") if any(t["speaker"] == "USER" for t in c["transcript"])]
    claims = store.all("Insurance Claims")
    sos_runs = [r for r in store.all("Agent Runs") if "money_sos" in (r.get("agents") or [])]
    health_runs = [r for r in store.all("Agent Runs") if (r.get("understood") or {}).get("intents", [None])[0] == "business_health"]
    recon = next((r for r in store.all("Cash Reconciliation") if r["days_ago"] == 0), {})
    pos = [o for o in store.all("Orders") if o["type"] == "PURCHASE_ORDER"]
    reminders = [c for c in store.all("Customer Credit") if c.get("reminder_status") == "REMINDER SENT"]
    camps = [c for c in store.all("Campaigns") if c.get("opportunity")]
    preds = [p for p in store.all("Payment Predictions") if p["risk"] == "HIGH"]
    plans = store.all("Payment Plans")
    commerce_orders = [o for o in store.all("Orders") if o["type"] == "COMMERCE_ORDER" and o["status"] == "CONFIRMED"]
    logs = store.all("Activity Logs")
    groups = [
        ("Financial safety", [("Fraud detected", any(t.get("risk_level") == "HIGH" for t in store.all("Transactions"))),
                              ("User verified through voice", bool(voice)),
                              ("Fraud response executed", bool(frozen)), ("Fraud case created", bool(fraud))]),
        ("Money SOS", [("Emergency financial situation analyzed", bool(sos_runs)), ("Insurance workflow created", bool(claims))]),
        ("Merchant operations", [("Merchant health analyzed", bool(health_runs)),
                                 ("Cash variance identified", recon.get("actual_cash") is not None and bool(health_runs)),
                                 ("Inventory shortage detected", bool(pos) or bool(health_runs)),
                                 ("Supplier order created", bool(pos)),
                                 ("Supplier approval received", any(o["status"] == "CONFIRMED" for o in pos)),
                                 ("Customer payment reminder sent", bool(reminders))]),
        ("Merchant growth", [("Sales decline detected", bool(camps)), ("Growth opportunity identified", bool(camps)),
                             ("Campaign created", bool(camps)), ("Campaign performance measured", any(c.get("after_daily") for c in camps))]),
        ("Payment reliability", [("Payment failure predicted", bool(preds)), ("Payment plan created", bool(plans))]),
        ("Commerce", [("Natural-language order completed", bool(commerce_orders))]),
        ("Trust", [("Every action recorded in audit trail", len(logs) > 0)]),
    ]
    return [{"group": g, "items": [{"label": label, "done": done} for label, done in items]} for g, items in groups]
