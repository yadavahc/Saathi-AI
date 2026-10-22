# SAATHI AI — API reference

Base URL `http://localhost:8000` (the dashboard proxies `/api/*`). All bodies are JSON unless noted. Live OpenAPI: `/docs`.

## Conversation & voice
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/chat` | `{text, persona: auto\|consumer\|merchant, language?: "auto", speak?: bool}` | `{run_id, reply, speech_text, language, audio_url, engine, agents[], approvals[], run}` |
| POST | `/api/voice/webhook` | multipart: `audio` file **or** `text`, `persona`, optional `call_id` | Same as chat + `transcript`, `stt_language`; with `call_id` returns the updated call |
| POST | `/api/tts` | `{text, language_code}` | `{audio_url}` |
| GET | `/api/audio/{id}` | — | `audio/wav` |

## Approvals
| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/api/approvals?status=PENDING` | — | Newest first |
| POST | `/api/approvals/{id}/approve` | `{by?, channel?}` | Executes the handler, verifies, returns final status (`EXECUTED`, `FAILED`, `AWAITING_THIRD_PARTY`) |
| POST | `/api/approvals/{id}/reject` | `{by?, channel?}` | Nothing executes |

## Domain endpoints
State-changing endpoints return a **PENDING approval**; they never execute directly.

| Method | Path | Body |
|---|---|---|
| POST | `/api/risk/analyze` | `{txn_id}` to score an existing txn, or `{transaction: {amount, time, recipient, recipient_id}}` / `{}` to inject one and run the full call flow |
| POST | `/api/fraud/freeze`, `/api/fraud/case` | `{txn_id}` |
| POST | `/api/money-sos/analyze` | `{amount, purpose}` |
| POST | `/api/money-sos/claim` | `{amount, reason}` |
| POST | `/api/merchant/analyze` | — (business health) |
| POST | `/api/merchant/reconcile` | — |
| POST | `/api/merchant/inventory` | `{item?}` |
| POST | `/api/merchant/order` | `{sku, quantity?}` |
| POST | `/api/customer/reminder` | `{customer_name}` |
| POST | `/api/campaign/create` | — |
| POST | `/api/campaign/publish` | `{campaign_id}` |
| POST | `/api/campaign/{id}/measure` | — |
| POST | `/api/commerce/intent` | `{text}` |
| POST | `/api/commerce/order` | `{merchant_id, items, total, delivery}` |
| POST | `/api/payment/predict` | `{user_id?, rp_id?}` |
| POST | `/api/payment/plan` | `{user_id?}` |

## Calls & webhooks
| Method | Path | Notes |
|---|---|---|
| GET | `/api/calls` | Calls with transcript, step, tool results |
| POST | `/api/calls/{id}/respond` | `{text}` — the user's spoken answer |
| POST | `/api/vobiz/webhook?call_id=&step=start\|answer` | Returns VobizXML; reads `Speech` / `Digits` |
| POST | `/api/telegram/webhook` | Telegram Update (messages, `callback_query`) |
| POST | `/api/telegram/simulate` | `{data}` — press an inline button from the dashboard |

`callback_data` formats: `apr:<approval_id>:approve|reject`, `po:<order_id>:accept|reject|counter`, `ord:<order_id>:accept|reject`.

## Dashboard
| Method | Path | Returns |
|---|---|---|
| GET | `/api/dashboard` | Everything the UI needs in one payload (metrics, radar, runs, calls, approvals, outbox, activity, domain tables, integrations, demo) |
| GET | `/api/activity?limit=&include_reads=` | Audit trail |
| GET | `/api/financial-radar` | Radar items |
| GET | `/api/agents`, `/api/agents/catalog` | Agent status / definitions |
| GET | `/api/runs` | Agent run traces |
| GET | `/api/health` | Integration status |

## Demo
| Method | Path | Body |
|---|---|---|
| POST | `/api/demo/start` | `{mode: autoplay\|presenter, scenario?: 1-8}` (no scenario = reset + all eight) |
| POST | `/api/demo/stop` | — |
| POST | `/api/demo/reset` | — (reloads seed data) |
| GET | `/api/demo` | Scenario statuses, narration, verified impact checklist |
