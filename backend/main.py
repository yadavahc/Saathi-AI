"""SAATHI AI — FastAPI entry point.

Run from the repo root:  backend/.venv/Scripts/python -m uvicorn backend.main:app --reload --port 8000
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Importing tool modules registers every tool with the orchestrator.
from backend.tools import commerce, comms, financial_safety, merchant_growth, merchant_ops, money_sos, payment_reliability, vision  # noqa: F401
from backend.agents import actions, snap  # noqa: F401  (registers approval handlers + hooks)
from backend.api import core, domain, shield, snap as snap_api, webhooks
from backend.config import settings
from backend.integrations.sheets import sheets
from backend.integrations.telegram import telegram
from backend.services import audit
from backend.utils.helpers import get_logger

log = get_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    sheets.start()
    telegram.on_photo(snap.from_telegram)
    telegram.start(actions.telegram_callback)
    audit.record("SAATHI AI started", agent="system", status="INFO", kind="system")
    log.info("SAATHI AI ready")
    yield


app = FastAPI(title="SAATHI AI", version="1.0.0", lifespan=lifespan,
              description="Autonomous multilingual financial & business action agent. "
                          "Don't just tell me what happened. Help me fix it.")
app.add_middleware(CORSMiddleware, allow_origins=[settings.frontend_origin, "http://localhost:3000", "http://127.0.0.1:3000"],
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(core.router)
app.include_router(domain.router)
app.include_router(webhooks.router)
app.include_router(shield.router)
app.include_router(snap_api.router)


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    log.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(status_code=500, content={"error": "internal_error", "detail": str(exc)})


@app.get("/")
def root() -> dict:
    return {"name": "SAATHI AI", "tagline": "Don't just tell me what happened. Help me fix it.", "docs": "/docs"}
