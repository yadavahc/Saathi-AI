"""Runtime configuration loaded from `.env` (never hardcode credentials)."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _flag(name: str, default: bool = False) -> bool:
    value = _env(name, "true" if default else "false").lower()
    return value in {"1", "true", "yes", "on"}


@dataclass
class Settings:
    anthropic_api_key: str = _env("ANTHROPIC_API_KEY")
    claude_model: str = _env("CLAUDE_MODEL", "claude-sonnet-5-5")

    sarvam_api_key: str = _env("SARVAM_API_KEY")
    sarvam_tts_model: str = _env("SARVAM_TTS_MODEL", "bulbul:v3")
    sarvam_stt_model: str = _env("SARVAM_STT_MODEL", "saaras:v4")
    sarvam_speaker: str = _env("SARVAM_SPEAKER", "shubh")

    vobiz_auth_id: str = _env("VOBIZ_AUTH_ID")
    vobiz_auth_token: str = _env("VOBIZ_AUTH_TOKEN")
    vobiz_from_number: str = _env("VOBIZ_FROM_NUMBER")
    vobiz_to_number: str = _env("VOBIZ_TO_NUMBER")

    telegram_bot_token: str = _env("TELEGRAM_BOT_TOKEN")
    telegram_default_chat_id: str = _env("TELEGRAM_DEFAULT_CHAT_ID")
    telegram_supplier_chat_id: str = _env("TELEGRAM_SUPPLIER_CHAT_ID")
    telegram_customer_chat_id: str = _env("TELEGRAM_CUSTOMER_CHAT_ID")
    telegram_family_chat_id: str = _env("TELEGRAM_FAMILY_CHAT_ID")
    telegram_polling: bool = _flag("TELEGRAM_POLLING", True)

    google_sheets_id: str = _env("GOOGLE_SHEETS_ID")
    google_service_account_file: str = _env("GOOGLE_SERVICE_ACCOUNT_FILE")

    public_base_url: str = _env("PUBLIC_BASE_URL").rstrip("/")
    frontend_origin: str = _env("FRONTEND_ORIGIN", "http://localhost:3000")
    demo_step_delay: float = float(_env("DEMO_STEP_DELAY", "2.2") or 2.2)

    seed_dir: Path = ROOT / "data" / "seed_data"


settings = Settings()
