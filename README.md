<div align="center">

# SAATHI AI

### Autonomous Multilingual Financial & Business Action Agent

**Don't just tell me what happened. Help me fix it.**

![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-backend-009688?logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs&logoColor=white)
![Claude](https://img.shields.io/badge/Claude-reasoning%20%26%20routing-D97757)
![Sarvam](https://img.shields.io/badge/Sarvam%20AI-Indian%20voice-6C47FF)
![Telegram](https://img.shields.io/badge/Telegram-action%20layer-26A5E4?logo=telegram&logoColor=white)
![Google Sheets](https://img.shields.io/badge/Google%20Sheets-data-34A853?logo=googlesheets&logoColor=white)

<img src="docs/screens/landing-hero.png" alt="SAATHI landing page" width="100%"/>

</div>

---

## Table of contents

1. [The problem — the Action Gap](#1-the-problem--the-action-gap)
2. [The solution](#2-the-solution)
3. [Screenshots](#3-screenshots)
4. [Architecture](#4-architecture)
5. [Multi-agent system](#5-multi-agent-system)
6. [Features in detail](#6-features-in-detail)
   * [🛡️ Scam Shield](#612-scam-shield--saathi-listens-to-a-suspicious-call-and-warns-you-live) · [📷 Snap & Act](#613-snap--act--a-photo-of-paper-becomes-verified-actions)
7. [Approval engine, audit trail & safety](#7-approval-engine-audit-trail--safety)
8. [Voice architecture](#8-voice-architecture)
9. [Integrations & fallbacks](#9-integrations--fallbacks)
10. [Data model (Google Sheets)](#10-data-model-google-sheets)
11. [Tech stack & project structure](#11-tech-stack--project-structure)
12. [Setup & run](#12-setup--run)
13. [Live demo walkthrough](#13-live-demo-walkthrough)
14. [API reference](#14-api-reference)
15. [Real-world path](#15-real-world-path)
16. [Future scope](#16-future-scope)

---

## 1. The problem — the Action Gap

Small merchants and everyday users already have plenty of data: transactions, recurring payments, sales, expenses, inventory, customer credit, suppliers. Existing apps do one of two things — **show** the data, or **alert** when something goes wrong. The user is still left to work out:

> What happened? Why? How serious is it? What should I do? Who should I contact? Should I approve it? **Did it actually happen?**

```mermaid
flowchart LR
    subgraph Today["Existing apps"]
        direction TB
        A1[Data] --> A2[Alert] --> A3["User figures out<br/>what to do"] --> A4[User acts alone]
    end
    subgraph Saathi["SAATHI"]
        direction TB
        B1[Data] --> B2[Understand] --> B3[Analyze & reason] --> B4[Recommend]
        B4 --> B5{Ask approval} -->|yes| B6[Act] --> B7[Verify] --> B8[Inform & log]
    end
    Today -. "the Action Gap" .-> Saathi
```

> **People don't lack financial or business data. They lack an intelligent action layer that turns that data into the right next action.**

## 2. The solution

SAATHI is a voice-first agent that **understands** a request or a system event in the user's own language, **retrieves** the right data, **reasons** about it, **recommends** the best next action, **asks for approval**, **executes** it through real tools, **verifies** the outcome against stored data and **reports back**.

| Traditional AI | SAATHI |
|---|---|
| "What happened?" → an answer | **Understand** what happened |
| | **Analyze** why |
| | **Recommend** what to do |
| | **Ask approval** — should I do it? |
| | **Execute** — do it |
| | **Verify** — did it work? |
| | **Measure** — what happened after? |

A traditional app says *"Your sales are down 31%."* SAATHI says:

> *"Your evening sales have fallen 31% and regular customers are down 12%. I recommend an Evening Tea + Snack Combo for ₹50, 4–7 PM. Shall I create and publish it?"*
> **Merchant:** "Yes." → **Campaign created · published · tracked** → later **₹8,200 → ₹11,700/day (+42.7%)**

Two users run through the whole product:

| | **Rahul** — everyday user, Bengaluru | **Lakshmi** — kirana store owner, Mysuru |
|---|---|---|
| Problems | Fraud attempts, emergencies, failing AutoPay, buying things | Falling sales, low stock, cash mismatch, unpaid customer credit |
| Talks to SAATHI | Phone call · app · Telegram | Voice in Kannada · app · Telegram |

---

## 3. Screenshots

### Landing page

A bright, claymorphic front door at `/` — word-by-word headline reveal, a phone mockup cycling through live SAATHI scenes over a floating Three.js clay scene (shield, coins, Telegram plane, spreadsheet), a scroll-pinned *Action Gap* story, a self-drawing loop diagram, a spotlight bento grid, live Scam Shield / Snap & Act demos, animated counters and a scroll-driven screenshot gallery (framer-motion + Lenis + React Three Fiber, honours *reduce motion*).

A cartoon guide, **Saathi**, waves from the hero and then walks along the page margins as you scroll — new pose and one-line tip per section, stepping and leaning with real motion; close him with ✕ and he walks back home (remembered per browser).

The centrepiece is a **one-minute cartoon product demo** built into the page: a video-style player with an **Indian male voiceover** (Sarvam Bulbul v3, pre-rendered per chapter and kept in sync with the playhead), play/pause, a scrubbable chapter timeline, captions and muted autoplay when in view. It animates the whole workflow — a suspicious payment, SAATHI calling Rahul through Sarvam + Vobiz, Claude choosing tools, the Telegram approval, Lakshmi's Google Sheet, the supplier tapping ACCEPT, Snap & Act catching an overcharge, and the audit trail verifying every step.

<img src="docs/screens/landing-demo.png" alt="Landing page — animated product demo" width="100%"/>

<img src="docs/screens/landing-wow.png" alt="Landing page — Scam Shield and Snap & Act demos" width="100%"/>

### Two surfaces

SAATHI has a **landing page** (`/`), a **user app** for real people (`/app`) and a **Control Room** for judges and operators that exposes every decision (`/console`).

<table>
<tr>
<td width="25%"><img src="docs/screens/app-login.png" alt="Login"/><br/><sub><b>Login</b> — two demo accounts</sub></td>
<td width="25%"><img src="docs/screens/app-rahul-home.png" alt="Rahul home"/><br/><sub><b>Rahul</b> — balance, alerts, payments</sub></td>
<td width="25%"><img src="docs/screens/app-rahul-call.png" alt="Incoming safety call"/><br/><sub><b>“SAATHI is calling”</b> — fraud check in Kannada</sub></td>
<td width="25%"><img src="docs/screens/app-rahul-activity.png" alt="What SAATHI did"/><br/><sub><b>Activity</b> — what SAATHI did, verified</sub></td>
</tr>
<tr>
<td><img src="docs/screens/app-lakshmi-home.png" alt="Lakshmi home"/><br/><sub><b>Lakshmi</b> — sales, cash, stock, dues</sub></td>
<td><img src="docs/screens/app-lakshmi-approval.png" alt="Approval card"/><br/><sub><b>Kanglish reply + approval card</b></sub></td>
<td colspan="2"><img src="docs/screens/live-call.png" alt="Live call in Control Room"/><br/><sub><b>Control Room — live AI call</b> with transcript, risk and current step</sub></td>
</tr>
</table>

### ✨ Wow features — Scam Shield & Snap & Act

<table>
<tr>
<td width="25%"><img src="docs/screens/app-shield-scam.png" alt="Scam Shield warning"/><br/><sub><b>Scam Shield</b> — live risk 98/100, Kannada warning, red flags, Claude's reason</sub></td>
<td width="25%"><img src="docs/screens/app-shield-actions.png" alt="Scam Shield actions"/><br/><sub><b>Protect yourself</b> — report · alert family · block (each needs OK)</sub></td>
<td width="25%"><img src="docs/screens/app-snap-bill.png" alt="Snap and act bill"/><br/><sub><b>Snap & Act</b> — bill photo → ₹200 overcharge caught</sub></td>
<td width="25%"><img src="docs/screens/app-shield-card.png" alt="Rahul home with Scam Shield"/><br/><sub><b>Rahul's home</b> — Scam Shield entry points</sub></td>
</tr>
</table>

| | |
|---|---|
| <img src="docs/screens/control-scam-shield.png" alt="Control room scam shield"/><br/>**Scam Shield (Control Room)** — risk meter, rules vs Claude, live transcript, red flags with the exact words heard | <img src="docs/screens/control-snap.png" alt="Control room snap and act"/><br/>**Snap & Act (Control Room)** — drop a photo, see what was read, what doesn't match, and the approvals |

### Control Room

<img src="docs/screens/control-room-fraud.png" alt="SAATHI Control Room during a live fraud check" width="100%"/>

| | |
|---|---|
| <img src="docs/screens/action-trace.png" alt="Action trace"/><br/>**Action Trace** — said → understood → data → decided → approval → tool → action → verified | <img src="docs/screens/merchant-health.png" alt="Merchant health"/><br/>**Merchant Health** — “Aaj business hegide?” answered with priorities |
| <img src="docs/screens/telegram-purchase-order.png" alt="Telegram purchase order"/><br/>**Inventory + Telegram purchase order** with ACCEPT / REJECT / COUNTER | <img src="docs/screens/financial-radar.png" alt="Financial radar"/><br/>**Financial Radar** — found · why it matters · recommendation · action |
| <img src="docs/screens/campaigns.png" alt="Campaigns"/><br/>**Campaigns** — detect → create → publish → measure | <img src="docs/screens/ai-agents.png" alt="AI agents"/><br/>**AI Agents** — six specialists and 52 tools |
| <img src="docs/screens/activity-log.png" alt="Activity log"/><br/>**Audit trail** — every decision explainable | <img src="docs/screens/impact.png" alt="Impact"/><br/>**Impact screen** — 24/24 outcomes verified against stored data |

> Screenshots were captured in sandbox mode (Telegram, Vobiz and Sheets switched to their dashboard fallbacks; Claude and Sarvam live).

---

## 4. Architecture

```mermaid
flowchart TB
    subgraph Users["Users & channels"]
        U1["📱 User app /app<br/>Rahul · Lakshmi"]
        U2["🖥️ Control Room /"]
        U3["☎️ Phone call<br/>(Vobiz)"]
        U4["✈️ Telegram buttons"]
    end

    subgraph Backend["FastAPI backend"]
        STT["Sarvam STT<br/>saaras:v4"]
        ORCH["Orchestrator<br/>the SAATHI loop"]
        ROUTER["Claude router<br/>intent · agents · entities · risk · language"]
        AGENTS["6 specialist agents"]
        TOOLS["Tool orchestrator<br/>52 tools · validate · run · log · trace"]
        APPROVE["Approval engine<br/>PENDING → APPROVED → EXECUTED"]
        VERIFY["Verify<br/>re-read stored state"]
        COMPOSE["Claude composer<br/>reply in user's language"]
        TTS["Sarvam TTS<br/>bulbul:v3"]
        AUDIT[("Audit trail +<br/>run trace")]
    end

    subgraph Data["Data & actions"]
        STORE[("Data store")]
        SHEETS[("Google Sheets<br/>17 sheets")]
        TG["Telegram Bot API"]
        VZ["Vobiz Voice API"]
    end

    U1 & U2 -->|text / audio| STT --> ORCH
    U3 <-->|VobizXML webhook| ORCH
    U4 -->|callback| APPROVE
    ORCH --> ROUTER --> AGENTS --> TOOLS
    AGENTS -->|proposals| APPROVE
    APPROVE -->|approved| TOOLS --> STORE
    TOOLS --> VERIFY
    STORE <-->|batched mirror| SHEETS
    TOOLS --> TG & VZ
    ORCH --> COMPOSE --> TTS --> U1
    TOOLS & APPROVE & ORCH --> AUDIT
```

### The core loop

Every feature follows the same loop (`backend/agents/orchestrator.py`):

```mermaid
flowchart LR
    R([Request / event]) --> U[Understand] --> I[Identify intent] --> D[Retrieve data] --> A[Analyze]
    A --> RE[Reason] --> REC[Recommend] --> Q{Approval<br/>required?}
    Q -->|yes| AP[Ask approval] -->|approved| EX[Execute tool]
    Q -->|no, read-only| INF
    AP -->|rejected| INF
    EX --> V[Verify result] --> UP[Update data] --> INF[Inform user] --> L[(Audit log)]
```

### The golden rule

| Claude is responsible for | Backend code is responsible for |
|---|---|
| Understanding, reasoning, routing, decision support, tool selection, wording the reply | Every calculation, every data change, orders, approvals, notifications, verification |

**Claude never modifies financial or business records.** It returns schema-constrained JSON (intents, entities, language); every rupee figure is computed by a tool, and every state change goes through the approval engine.

---

## 5. Multi-agent system

```mermaid
flowchart LR
    M["User message<br/>“My sales are down and my<br/>rice stock is almost finished”"] --> C{{"Claude router<br/>(structured output)"}}
    C -->|inventory_check| OPS["🏪 Merchant Operations"]
    C -->|growth_campaign| GRO["📈 Merchant Growth"]
    C -.->|fraud_check| SAF["🛡️ Financial Safety"]
    C -.->|money_sos| SOS["🚨 Money SOS"]
    C -.->|payment_risk| PAY["📡 Payment Reliability"]
    C -.->|purchase_request| COM["🛒 Commerce"]
    OPS --> P1["Approval 1:<br/>Order 50 KG rice · ₹2,400"]
    GRO --> P2["Approval 2:<br/>Evening combo ₹50"]
```

Claude returns `language`, `intents[]` (each with `intent`, `confidence`, `entities`), `risk_level`, `requires_confirmation` and `reasoning`. One sentence can trigger several agents, and each recommended action is approved **individually**.

| Agent | Purpose | Tools |
|---|---|---|
| 🛡️ **Financial Safety** | Suspicious transactions, recipient checks, fraud response | `get_transaction` `calculate_transaction_risk` `verify_recipient` `calculate_payment_risk` `freeze_transaction` `create_fraud_case` `send_fraud_alert` |
| 🚨 **Money SOS** | Urgent money — insurance first, savings above an EMI reserve, credit last | `get_financial_summary` `get_insurance_details` `get_upcoming_payments` `find_funding_options` `create_insurance_claim` |
| 🏪 **Merchant Operations** | Sales, expenses, cash, inventory, suppliers, customer credit | `get_sales_summary` `get_expenses` `get_cash_records` `reconcile_cash` `check_inventory` `calculate_reorder` `create_purchase_order` `get_customer_credit` `send_payment_reminder` |
| 📈 **Merchant Growth** | Declines, churn, campaigns, ROI, health score, next-best action | `analyze_sales` `identify_growth_opportunity` `identify_customer_churn` `generate_campaign` `send_campaign` `calculate_campaign_roi` `calculate_business_health` `generate_next_best_action` |
| 📡 **Payment Reliability** | Predict AutoPay/mandate failures before they happen | `get_upcoming_payments` `get_balance_history` `get_recurring_payments` `predict_payment_failure` `calculate_payment_shortfall` `find_upcoming_income` `create_payment_plan` `send_payment_reminder` |
| 🛒 **Commerce** | Buy things from one natural-language sentence | `parse_purchase_intent` `find_merchants` `compare_prices` `check_availability` `send_merchant_request` `get_merchant_response` `create_order` |

Shared tools: `get_user`, `send_telegram`, `transfer_to_human`.

### Tool orchestrator

Every one of the 52 tools is wrapped by `backend/tools/registry.py`, so each one automatically:

1. validates inputs (`pydantic.validate_call`)
2. performs the operation
3. returns a structured JSON envelope `{tool, agent, status, data, error, simulated, duration_ms}`
4. updates the relevant data
5. writes an activity-log entry
6. updates the dashboard (store version + run trace)
7. handles errors — never raises; returns `FAILED` / `INVALID_INPUT` / `ERROR`

---

## 6. Features in detail

### 6.1 Fraud detection with a live voice call

```mermaid
sequenceDiagram
    autonumber
    participant T as Transaction
    participant S as Financial Safety Agent
    participant V as Vobiz call + Sarvam voice
    participant R as Rahul
    participant A as Approval engine
    participant TG as Telegram
    T->>S: ₹25,000 · 11:47 PM · new recipient
    S->>S: calculate_transaction_risk → 91/100 HIGH
    S->>V: Place call (Kannada)
    V->>R: "Idu neevu maadidira?" (Did you make this?)
    R-->>V: "No" (or press 2)
    V->>R: "Block maadi fraud complaint register maadla?"
    R-->>A: "Yes" (or press 1) → APPROVED
    A->>S: freeze_transaction · create_fraud_case · send_fraud_alert
    S->>S: Verify: Transactions.status = FROZEN, case OPEN
    S->>TG: 🛡️ Fraud alert + case number
    V->>R: "Transaction block aagide. Complaint number FRD-1101."
```

Risk is deterministic and explainable:

| Factor | Weight | Demo value |
|---|---|---|
| Amount ≥ 20× historical average | 35 | ₹25,000 vs ₹850 |
| Late night (23:00–05:00) | 18 | 11:47 PM |
| First payment to recipient | 20 | new recipient |
| Recipient intelligence (fraud reports, account age) | 15 | 3 reports, 2-day-old account |
| Unrecognised device | 3 | new device |
| **Total** | | **91/100 — HIGH** |

### 6.2 Money SOS

*"I need ₹80,000 urgently."* → SAATHI asks the purpose → *"hospital admission"* → plan:

| Source | Amount | Cost |
|---|---|---|
| Cashless health-insurance claim | ₹60,000 | ₹0 |
| Savings (keeps ₹12,000 for the ₹8,000 EMI) | ₹20,000 | ₹0 |
| Pre-approved loan | not needed | — |

One approval → claim **CLM-2041 SUBMITTED**.

### 6.3 Merchant business health — in Kannada

*"Aaj business hegide?"* → SAATHI ranks findings by **urgency × rupee impact** and answers with *what matters most + why + what to do*, not a data dump:

> *"Nimma sales ivattu 29.6% increase aagide. Aadare evening sales 31% decrease aagide. Rice stock kooda critical level alli ide. Modalu rice order maadla?"*

| Sales | Previous | Growth | Expenses | Expected cash | Actual cash | Variance | Rice | Credit | Evening |
|---|---|---|---|---|---|---|---|---|---|
| ₹18,400 | ₹14,200 | +29.6% | ₹7,200 | ₹11,200 | ₹10,700 | −₹500 | LOW | ₹8,500 | −31% |

### 6.4 Cash reconciliation

`expected = cash sales − cash expenses = ₹18,400 − ₹7,200 = ₹11,200` → counted ₹10,700 → **variance −₹500**. On approval SAATHI stores date, expected, actual, variance, reason, approved_by and timestamp. All maths runs in backend code.

### 6.5 Inventory autopilot + supplier automation

```mermaid
flowchart LR
    S["Rice 8 KG<br/>min 25 KG"] --> C["calculate_reorder<br/>(25−8) + 6 KG/day × 2 days = 29 KG<br/>→ 1 pack of 50 KG"] --> P{"Approve<br/>50 KG · ₹2,400?"}
    P -->|Howdu| PO["create_purchase_order"] --> TG["Telegram PO<br/>[ACCEPT] [REJECT] [COUNTER]"]
    TG -->|ACCEPT| OK["ORDER CONFIRMED<br/>inventory: +50 KG incoming<br/>merchant notified · audit logged"]
    TG -->|COUNTER| NA["New approval:<br/>accept counter price?"]
    TG -->|REJECT| RJ["Order rejected, logged"]
```

### 6.6 Merchant growth — detect → create → measure

`analyze_sales` (week-over-week by time slot) + `identify_customer_churn` → **evening −31%, regulars −12%** → `generate_campaign` (tea ₹15 + snack ₹40 → **combo ₹50, 4–7 PM**, price maths in code) → approval → `send_campaign` → `calculate_campaign_roi` → **₹8,200 → ₹11,700/day (+42.7%)**. Post-campaign sales are simulated in the sandbox and labelled.

### 6.7 Payment failure prediction

$$P(\text{fail}) = \frac{1}{1 + e^{8\,(\text{coverage} - 0.82)}}, \qquad \text{coverage} = \frac{\text{projected balance on due date}}{\text{amount due}}$$

| | Before | After payment plan |
|---|---|---|
| AutoPay due | ₹8,999 in 6 days | ₹8,999 |
| Projected balance | ₹5,200 (salary lands after due date) | ₹10,200 |
| Shortfall | ₹3,799 | ₹0 |
| **Failure probability** | **87% — HIGH** | **8% — LOW** |

Plan = shortfall + 25% buffer, rounded up to ₹500 → **sweep ₹5,000 from savings the day before**. SAATHI re-runs the prediction to verify the risk dropped.

### 6.8 Customer credit

*"Ramesh ge reminder kalisu."* → Ramesh owes ₹4,500, 7 days overdue → polite bilingual (Kannada + English) reminder → approval → Telegram → **REMINDER SENT** (customer, amount, message, timestamp, status recorded).

### 6.9 Natural-language commerce

*"I need 20 notebooks and 10 pens tomorrow under ₹2,000."*

| Vendor | Total | Delivery | Result |
|---|---|---|---|
| PQR Office Mart | ₹1,500 | Day after tomorrow | ✗ insufficient stock |
| **ABC Stationers** | **₹1,620** | **Tomorrow 9 AM** | ✅ **selected** |
| XYZ Book Depot | ₹1,750 | Tomorrow 5 PM | ₹130 more expensive |

Intent understood → merchants found → prices compared → best selected → merchant contacted on Telegram → accepted → **ORDER CONFIRMED · ₹1,620 · Tomorrow 9 AM**.

### 6.10 Financial Radar

A proactive feed computed from live data. Every alert has **what we found · why it matters · what SAATHI recommends · take action**:

| Level | Example |
|---|---|
| 🔴 HIGH | ₹8,999 recurring payment · 87% failure probability · due in 6 days |
| 🟠 MEDIUM | ₹4,500 receivable · 7 days overdue |
| 🟡 WATCH | Insurance premium · due in 12 days |
| 🟢 HEALTHY | Expected income ₹28,000 |

### 6.11 Key visualizations

* **Action Trace** — what the user said → what SAATHI understood → what data it found → what it decided → what approval was required → what tool it used → what action happened → what result was verified.
* **Live Agent Flow** — animated USER → VOICE/TEXT → INTENT → AGENT → DATA → REASONING → APPROVAL → TOOL → ACTION → RESULT.
* **Live Call panel** — user, language, status, reason, risk, current step and backend actions.
* **Top metrics** — active calls, high-risk transactions, pending approvals, today's sales, inventory alerts, outstanding credit, predicted payment failures, AI actions.

---

### 6.12 Scam Shield — SAATHI listens to a suspicious call and warns you live

India's fastest-growing fraud starts **before** any payment: fake police "digital arrest" calls, drugs-in-parcel stories, fake bank KYC, OTP and AnyDesk requests. Scam Shield joins the call, listens, and warns the user **in Kannada while the call is still going on**.

```mermaid
flowchart LR
    subgraph Sources["How SAATHI hears the call"]
        P["☎️ Phone<br/>SAATHI calls you,<br/>you merge the scam call"]
        M["🎙️ Speakerphone<br/>browser mic, 6 s clips"]
        D["🎭 Demo call<br/>scripted, voiced by Sarvam"]
    end
    P -->|"Vobiz Stream websocket<br/>L16 / 16 kHz frames"| W["5 s windows"] --> STT["Sarvam STT"]
    M --> STT
    D --> I
    STT --> I["ingest()"]
    I --> RU["Red-flag rules<br/>Hindi · Kannada · English<br/>native + Latin script"]
    I --> CL["Claude reads the whole<br/>conversation → scam type"]
    RU & CL --> RISK{"risk = max(rules, Claude)"}
    RISK -->|"≥ 35"| S1["⚠️ SUSPICIOUS<br/>Kannada voice warning"]
    RISK -->|"≥ 70"| S2["🚨 SCAM<br/>warning spoken into the call<br/>+ Telegram alert"]
    S2 --> AP["Approvals: report to Chakshu / 1930 ·<br/>alert family · block number"]
```

| Red flag (explainable rule) | Weight | Example it catches |
|---|---|---|
| Pretends to be police / CBI / RBI / customs | 22 | "Mumbai Cyber Crime se Inspector…", "SBI head office" |
| Threatens arrest, FIR, "digital arrest" | 25 | "Aapko digital arrest kiya ja raha hai" |
| Fake parcel / drugs / passport story | 15 | "FedEx parcel mein drugs mile hain" |
| Fake KYC / account or SIM block | 15 | "KYC expire aagide, account block aagutte" |
| Asks for OTP, PIN, CVV or a remote-access app | 30 | "OTP bataiye", "AnyDesk install maadi" |
| Money to a "safe account" / UPI ID | 30 | "RBI safe account mein transfer kijiye" |
| Stay on the call, tell no one | 18 | "Call disconnect mat kijiye, kisi ko mat bataiye" |
| Extreme urgency | 10 | "Abhi turant", "hattu nimisha maatra" |
| Prize / refund bait | 15 | "You have won a lottery" |

**Tested results** (real Sarvam voices + Claude):

| Call | Verdict | Risk | Notes |
|---|---|---|---|
| "Digital arrest" scam (Hinglish) | 🚨 SCAM | 100 | 7 red flags; Claude: *digital_arrest*, 0.99 |
| Fake bank KYC scam (Kannada) | 🚨 SCAM | 98 | Authority + KYC + OTP/AnyDesk + urgency |
| Genuine pharmacy call (English) | ✅ SAFE | 4 | No red flags — no false alarm |
| Live phone stream (Hindi speech, Vobiz frame format) | 🚨 SCAM | 95 | Warning streamed back into the call as `playAudio` |

**Phone mode:** tap *Protect a phone call* → SAATHI calls you (Vobiz) and says *"SAATHI Shield on aagide — merge the suspicious call"* → merge it → Vobiz forks the call audio to `wss://…/api/shield/stream/{id}` → every ~5 s of speech is transcribed and scored → warnings are spoken back into the same call.

### 6.13 Snap & Act — a photo of paper becomes verified actions

Most kirana stores still run on paper. Lakshmi photographs it — in the app, the Control Room, or by **sending the photo to the Telegram bot** — and SAATHI reads it with **Claude vision**, checks it against her records in code, and proposes actions.

```mermaid
flowchart LR
    PH["📷 Photo<br/>app · Control Room · Telegram"] --> V["Claude vision<br/>classify + extract<br/>(schema-constrained JSON)"]
    V -->|khata| K["reconcile_khata<br/>fuzzy-match names to<br/>Customer Credit"] --> KA["Approve → credit book updated"]
    V -->|supplier bill| B["match_bill_to_order<br/>billed rate vs PO / agreed cost"] --> BA["Approve → dispute overcharge<br/>(Telegram to supplier)<br/>+ record delivery at fair amount"]
    V -->|shelf| S["assess_shelf<br/>map bins to inventory"] --> SA["Approve → purchase orders<br/>for empty / low items"]
```

| Photo | What SAATHI read | What it found | Actions |
|---|---|---|---|
| Handwritten **khata** page | Ramesh 4500 − 1000 paid = 3500, Suresh 2500, Meena 1500, Ravi 3200 (new), Kavya 800 (new) | Ramesh ₹4,500 → ₹3,500 · 2 new customers (₹4,000) | Update credit book → total ₹11,500 |
| **Supplier bill** AB/2291 | Rice 50 KG @ ₹52, Sugar 20 KG @ ₹40 = ₹3,400 | Rice agreed at ₹48 → **₹200 overcharge** | Dispute on Telegram · record delivery at fair ₹3,200 · stock +50 KG / +20 KG |
| **Shelf** photo | Rice empty, Tea low, Sugar / Oil full, Dal half | Rice and tea need reorder | Purchase orders to suppliers |

Only perception uses AI — matching, price checks and every record change are deterministic backend code. If Claude is unreachable, the built-in samples fall back to stored readings so the demo never breaks.

## 7. Approval engine, audit trail & safety

```mermaid
stateDiagram-v2
    [*] --> PENDING: agent proposes action
    PENDING --> REJECTED: user says no
    PENDING --> APPROVED: user approves<br/>(app · voice · Telegram)
    APPROVED --> EXECUTED: handler runs tools<br/>+ verification passes
    APPROVED --> FAILED: verification fails
    APPROVED --> AWAITING_THIRD_PARTY: needs supplier / merchant
    AWAITING_THIRD_PARTY --> EXECUTED: accepted
    AWAITING_THIRD_PARTY --> FAILED: rejected / countered
    REJECTED --> [*]
    EXECUTED --> [*]
    FAILED --> [*]
```

Every sensitive action is a standardized approval object:

```json
{
  "approval_id": "APR-1003",
  "action": "CREATE_PURCHASE_ORDER",
  "description": "Order 50 KG Sona Masoori Rice from ABC Stores (Wholesale)",
  "amount": 2400,
  "impact": "Avoids a stock-out in ~1.3 day(s)",
  "target": "ABC Stores (Wholesale)",
  "reason": "Order 50 KG Sona Masoori Rice ≈ ₹2,400",
  "requires_confirmation": true,
  "status": "PENDING"
}
```

**Audit trail** — every routing decision, tool call, approval and action is logged with timestamp, user, intent, agent, tool, input, decision, approval, result and status:

```text
23:47 — Fraud detected: ₹25,000 at 11:47 PM — risk 91/100 HIGH
23:48 — Voice verification call started (vobiz)
23:49 — User denied the transaction by voice
23:49 — Approved by Rahul (voice): Block ₹25,000 payment and register a fraud complaint
23:49 — freeze_transaction() → SUCCESS
23:49 — create_fraud_case() → SUCCESS: Fraud case FRD-1101 opened
23:50 — send_fraud_alert() → SUCCESS: Telegram alert sent
```

**Safety rules**

* SAATHI **never asks for OTP, PIN, CVV, passwords or banking credentials**; messages containing them are intercepted before any agent runs.
* **No approval → no execution.** State-changing endpoints return a PENDING approval instead of acting.
* **Never claims success unless the backend confirms it** — handlers re-read stored state and record a verification string.
* Financial actions are **sandboxed** and labelled *Sandbox / Demo mode / simulated* in the UI.
* No autonomous irreversible financial-loss decisions.

---

## 8. Voice architecture

```mermaid
flowchart LR
    MIC["🎙️ Browser mic"] -->|webm| API["/api/voice/webhook"]
    API --> STT["Sarvam STT<br/>saaras:v4<br/>auto language"]
    STT --> LOOP["SAATHI loop<br/>(Claude routes in that language)"]
    LOOP --> CMP["Claude composer<br/>text + native-script speech_text"]
    CMP --> TTS["Sarvam TTS<br/>bulbul:v3 · kn-IN / hi-IN / …"]
    TTS --> PLAY["🔊 /api/audio/{id}"]

    PHONE["☎️ Vobiz call"] -->|answer_url| WH["/api/vobiz/webhook"]
    WH -->|"VobizXML: Gather + Play (Sarvam audio)"| PHONE
    PHONE -->|"Speech (en-IN) or keypad 1 / 2"| WH
```

* Languages: **English, Hindi, Kannada, Tamil, Telugu, Marathi, Bengali, Hinglish, Kanglish** and code-mixed speech; replies come back in the same language.
* For Kanglish/Hinglish, Claude returns a Latin-script on-screen reply **and** a native-script `speech_text` so Sarvam pronounces it naturally.
* Phone calls speak Kannada through Sarvam audio. Vobiz speech recognition supports English (`en-IN`), so callers answer "yes/no" or press **1/2**. Silence re-prompts up to three times.

---

## 9. Integrations & fallbacks

| Integration | Used for | If unavailable |
|---|---|---|
| **Claude** (`claude-sonnet-5-5`) | Routing (structured JSON), multilingual replies, scam-call analysis, **vision** for Snap & Act | Keyword router + templates; rule-only Scam Shield; stored sample readings |
| **Sarvam AI** | Speech-to-text and text-to-speech in Indian languages | Text-only / simulated voice |
| **Vobiz** | Fraud-verification calls; **live call-audio streaming** (`<Stream>` websocket) for Scam Shield | Simulated live-call panel; speakerphone / demo Scam Shield |
| **Telegram Bot API** | Approvals, purchase orders, reminders, alerts — with working buttons | Messages and buttons shown in the dashboard outbox |
| **Google Sheets** | Hackathon data backend (17 sheets, batched writes) | Local seeded JSON data |

**The complete demo runs with zero credentials.**

---

## 10. Data model (Google Sheets)

On startup SAATHI creates or loads 17 sheets and mirrors every write through a batched queue (one `values.batchUpdate` every few seconds, so a full demo needs about a dozen API requests).

```mermaid
erDiagram
    USERS ||--o{ TRANSACTIONS : makes
    USERS ||--|| FINANCIAL_DATA : has
    USERS ||--o{ RECURRING_PAYMENTS : owes
    TRANSACTIONS ||--o| FRAUD_CASES : "may open"
    RECURRING_PAYMENTS ||--o{ PAYMENT_PREDICTIONS : "scored by"
    MERCHANTS ||--o{ INVENTORY : stocks
    MERCHANTS ||--o{ SALES : records
    MERCHANTS ||--o{ EXPENSES : records
    MERCHANTS ||--o{ CUSTOMER_CREDIT : extends
    MERCHANTS ||--o{ CAMPAIGNS : runs
    MERCHANTS ||--o{ CASH_RECONCILIATION : closes
    SUPPLIERS ||--o{ ORDERS : fulfils
    INVENTORY }o--|| SUPPLIERS : "supplied by"
    APPROVALS ||--o{ ACTIVITY_LOGS : "logged in"
```

`Users · Transactions · Financial Data · Recurring Payments · Merchants · Inventory · Sales · Expenses · Customer Credit · Orders · Suppliers · Campaigns · Fraud Cases · Cash Reconciliation · Payment Predictions · Activity Logs · Approvals`

---

## 11. Tech stack & project structure

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React 18, Tailwind CSS, Recharts, framer-motion, Lenis, Three.js (React Three Fiber + drei), lucide-react |
| Backend | Python, FastAPI, Pydantic |
| AI | Claude API (structured outputs), Sarvam AI |
| Voice | Sarvam (STT/TTS), Vobiz (telephony) |
| Communication | Telegram Bot API |
| Data | Google Sheets API (gspread), local JSON seed fallback |
| Config | `.env` / `.env.example` — no hardcoded credentials |

```text
backend/
  agents/        orchestrator, Claude router, composer, 6 agents, approval action handlers
  tools/         52 tools + registry (validation, logging, tracing, error handling)
  services/      store, approvals, audit, run trace, calls, financial radar, user-app view
  integrations/  claude_client, sarvam, vobiz, telegram, sheets
  api/           core (chat, voice, dashboard, approvals, calls, demo, user app), domain, webhooks
  models/        Pydantic request schemas
  demo/          START LIVE DEMO runner + verified impact checklist
  main.py
frontend/
  app/           / (landing page), /console (Control Room), /app (user app)
  components/landing/  landing page sections, cartoon demo player, 3D clay scene
  components/    Action Trace, Live Agent Flow, Live Call, Console, user app components
  dashboard/     13 Control Room views
  hooks/ services/
data/
  generate_seed.py, seed_data/*.json   (one file per sheet)
docs/
  DEMO_SCRIPT.md, API.md, screenshots/
```

---

## 12. Setup & run

### Requirements

Python 3.11+ (tested on 3.14) and Node 18+ (tested on 22).

### Install

```bash
git clone https://github.com/yadavahc/Saathi-AI.git
cd Saathi-AI

# backend
python -m venv backend/.venv
backend/.venv/Scripts/pip install -r backend/requirements.txt          # Windows
# backend/.venv/bin/pip install -r backend/requirements.txt            # macOS / Linux

# frontend
cd frontend && npm install && cd ..

# configuration
cp .env.example .env      # fill in whichever keys you have — all are optional
```

### Run

```bash
# terminal 1 — backend (from the repo root)
backend/.venv/Scripts/python -m uvicorn backend.main:app --port 8000

# terminal 2 — frontend
cd frontend && npm run dev
```

| URL | What |
|---|---|
| http://localhost:3000 | Landing page |
| http://localhost:3000/console | Control Room |
| http://localhost:3000/app | User app (Rahul / Lakshmi) |
| http://localhost:8000/docs | Interactive API docs |

### Environment variables

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY`, `CLAUDE_MODEL` | Claude routing and replies |
| `SARVAM_API_KEY`, `SARVAM_TTS_MODEL`, `SARVAM_STT_MODEL`, `SARVAM_SPEAKER` | Indian-language voice |
| `VOBIZ_AUTH_ID`, `VOBIZ_AUTH_TOKEN`, `VOBIZ_FROM_NUMBER`, `VOBIZ_TO_NUMBER` | Real phone calls (also needs `PUBLIC_BASE_URL`) |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_DEFAULT_CHAT_ID`, `TELEGRAM_SUPPLIER_CHAT_ID`, `TELEGRAM_CUSTOMER_CHAT_ID`, `TELEGRAM_FAMILY_CHAT_ID`, `TELEGRAM_POLLING` | Telegram action layer (family chat receives Scam Shield alerts) |
| `GOOGLE_SHEETS_ID`, `GOOGLE_SERVICE_ACCOUNT_FILE` | Google Sheets backend |
| `PUBLIC_BASE_URL` | Public URL (e.g. ngrok) for Vobiz / Telegram webhooks |
| `FRONTEND_ORIGIN`, `DEMO_STEP_DELAY` | CORS origin, demo pacing |

<details>
<summary><b>Claude setup</b></summary>

Create a key at platform.claude.com and set `ANTHROPIC_API_KEY`. SAATHI calls the Messages API with structured outputs (`output_config.format` JSON schema) at low effort for latency, with server-side refusal fallbacks enabled. Any API failure falls back to deterministic rules for that request.
</details>

<details>
<summary><b>Sarvam setup</b></summary>

Get a key at dashboard.sarvam.ai → `SARVAM_API_KEY`. STT: `POST /speech-to-text` (`saaras:v4`, language auto-detect). TTS: `POST /text-to-speech` (`bulbul:v3`, speaker `shubh`). Audio is cached in memory and served at `/api/audio/{id}`.
</details>

<details>
<summary><b>Telegram setup</b></summary>

1. Create a bot with **@BotFather** → `TELEGRAM_BOT_TOKEN`.
2. Start the backend and send **/start** to the bot — SAATHI links the first chat it sees (logged as `Telegram chat linked: <id>`). Save that id in `TELEGRAM_DEFAULT_CHAT_ID`.
3. Local development uses long polling (`TELEGRAM_POLLING=true`); with a public URL set `TELEGRAM_POLLING=false` and SAATHI registers `/api/telegram/webhook`.
</details>

<details>
<summary><b>Vobiz setup</b></summary>

Set `VOBIZ_AUTH_ID`, `VOBIZ_AUTH_TOKEN`, your Vobiz number in `VOBIZ_FROM_NUMBER`, the phone to call in `VOBIZ_TO_NUMBER`, and expose the backend (`ngrok http 8000`) as `PUBLIC_BASE_URL`. Calls use `POST https://api.vobiz.ai/api/v1/Account/{auth_id}/Call/`; Vobiz fetches `/api/vobiz/webhook`, which returns VobizXML (`<Gather inputType="dtmf speech">` + `<Play>` of Sarvam audio). Trial accounts may only call verified numbers.
</details>

<details>
<summary><b>Google Sheets setup</b></summary>

1. Create a Google Cloud service account, enable the Sheets and Drive APIs and download the JSON key into `credentials/` (gitignored).
2. Share your spreadsheet with the service-account email as **Editor**.
3. Set `GOOGLE_SHEETS_ID` (from the sheet URL) and `GOOGLE_SERVICE_ACCOUNT_FILE`.
</details>

---

## 13. Live demo walkthrough

Press **START LIVE DEMO** in the Control Room. *Autoplay* scripts the human answers; *Presenter* waits for you to approve in the app, by voice or on Telegram. Every scenario runs on the real stack.

| # | Scenario | Outcome |
|---|---|---|
| 1 | **Fraud** — ₹25,000 at 11:47 PM, new recipient | Risk 91/100 → Kannada voice call → "No" → "Yes" → frozen, case FRD-1101, Telegram alert |
| 2 | **Money SOS** — "I need ₹80,000 urgently" | Insurance ₹60,000 + savings ₹20,000 → claim CLM-2041 |
| 3 | **Business health** — "Aaj business hegide?" | Prioritised Kanglish answer |
| 4 | **Inventory** — rice 8 KG | 50 KG / ₹2,400 → Telegram PO → supplier accepts → ORDER CONFIRMED |
| 5 | **Growth** — evening −31% | Tea + Snack Combo ₹50 → published → +42.7% |
| 6 | **Payment prediction** — ₹8,999 AutoPay | 87% failure → ₹5,000 sweep → 8% |
| 7 | **Customer credit** — "Ramesh ge reminder kalisu" | REMINDER SENT |
| 8 | **Commerce** — "20 notebooks + 10 pens under ₹2,000" | ABC ₹1,620 → ORDER CONFIRMED |
| 9 | **Scam Shield** — fake police 'digital arrest' call | Red flags light up live → Kannada warning → reported, family alerted, number blocked |
| 10 | **Snap & Act** — photo of a supplier bill | ₹200 overcharge caught → dispute sent → delivery recorded at fair ₹3,200 |

The demo ends on an **impact screen** where each of the 24 checkmarks is computed from stored data. A presenter script is in [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md).

---

## 14. API reference

Full reference: [docs/API.md](docs/API.md) · live OpenAPI at `/docs`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/chat` | Text → full SAATHI loop |
| POST | `/api/voice/webhook` | Audio (or text) → STT → loop → TTS |
| POST | `/api/vobiz/webhook` · `/api/telegram/webhook` | Phone call / Telegram callbacks |
| POST | `/api/risk/analyze` · `/api/fraud/freeze` · `/api/fraud/case` | Fraud |
| POST | `/api/money-sos/analyze` · `/api/money-sos/claim` | Money SOS |
| POST | `/api/merchant/analyze` · `/reconcile` · `/inventory` · `/order` | Merchant operations |
| POST | `/api/customer/reminder` | Customer credit |
| POST | `/api/campaign/create` · `/api/campaign/publish` | Growth |
| POST | `/api/commerce/intent` · `/api/commerce/order` | Commerce |
| POST | `/api/payment/predict` · `/api/payment/plan` | Payment reliability |
| POST | `/api/approvals/{id}/approve` · `/reject` | Approval engine |
| GET | `/api/dashboard` · `/activity` · `/approvals` · `/calls` · `/financial-radar` · `/agents` | Control Room data |
| GET | `/api/app/{user_id}` | User app — one person's own data |
| POST | `/api/shield/start` · `/{id}/audio` · `/{id}/text` · `/{id}/end` | Scam Shield sessions (simulation · mic · phone) |
| POST · WS | `/api/shield/vobiz/answer` · `/api/shield/stream/{id}` | Phone mode: VobizXML `<Stream>` + live audio websocket |
| POST | `/api/snap` · `/api/snap/sample/{name}` | Snap & Act: upload a photo / try a sample |
| GET | `/api/snap` · `/api/snap/image/{doc_id}` | Processed documents and their images |
| POST | `/api/demo/start` · `/stop` · `/reset` | Demo mode |

---

## 15. Real-world path

SAATHI does not replace Paytm, PhonePe or a bank — it is the **action layer they are missing**. Each tool is a single function, so moving from sandbox to production means swapping what is inside a tool; agents, approvals, voice, audit and dashboards stay the same.

| Capability | Production route in India |
|---|---|
| Read bank transactions & balances | **Account Aggregator** framework (RBI / Sahamati) via a licensed partner |
| Merchant sales & settlements | Merchant APIs — Paytm for Business, PhonePe, Razorpay, Cashfree |
| Freeze a payment / sweep savings | Partner **bank or payment app** (SAATHI as an embedded feature) |
| Report fraud | Bank dispute flow + cybercrime.gov.in / 1930 |
| Insurance claims | Insurer / TPA APIs |
| Billing & stock | Vyapar, Khatabook, Tally, Petpooja |
| Messaging | WhatsApp Business API alongside Telegram |

## 16. Future scope

* Account Aggregator consent flows and real bank / UPI mandate APIs behind the same approval engine
* Streaming STT for sub-second Scam Shield reaction, caller-ID reputation (e.g. Truecaller for Business) and deepfake-voice detection
* Snap & Act for UPI screenshots and handwritten price lists; WhatsApp photo intake
* Learned risk and churn models, keeping today's rule-based scores as explainable baselines
* WhatsApp Business channel, multi-merchant tenancy and role-based approvals
* Mobile-number / Telegram login and per-user memory (trusted recipients, preferences)

---

<div align="center">

Built by **Yadava H C**

</div>
