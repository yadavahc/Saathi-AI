"""Telegram Bot API — the execution and approval channel.

Every outgoing message is also written to the Outbox table so the dashboard
can display it (and its buttons) even when Telegram is unavailable.
Inline buttons carry `callback_data` that hits /api/telegram/webhook, or the
built-in long-polling loop when no public webhook URL exists.
"""
from __future__ import annotations

import queue
import threading
import time
from typing import Callable

import httpx

from backend.config import settings
from backend.services.store import store
from backend.utils.helpers import get_logger, now_iso

log = get_logger("telegram")


class TelegramClient:
    def __init__(self) -> None:
        self.token = settings.telegram_bot_token
        self.enabled = bool(self.token)
        self.default_chat = settings.telegram_default_chat_id
        self.status = "simulated"
        self.detail = "Telegram not configured — messages shown in dashboard outbox."
        self.bot_username = ""
        self._callback_handler: Callable[[str, str], str] | None = None
        self._photo_handler: Callable[[bytes, str], None] | None = None
        # Pooled keep-alive clients: a fresh TLS handshake to Telegram costs ~1.5 s.
        self._http = httpx.Client(timeout=20)
        self._poll_http = httpx.Client(timeout=40)
        # Outgoing traffic is queued so a slow network never blocks an action.
        self._jobs: queue.Queue = queue.Queue()
        if self.enabled:
            self.status = "live" if self.default_chat else "waiting"
            self.detail = "Connected" if self.default_chat else "Send /start to the bot to link a chat."

    # ── setup ──────────────────────────────────────────────────────────────
    def _api(self, method: str, _client: httpx.Client | None = None, **payload) -> dict | None:
        try:
            response = (_client or self._http).post(f"https://api.telegram.org/bot{self.token}/{method}", json=payload)
            body = response.json()
            if not body.get("ok"):
                log.warning("Telegram %s failed: %s", method, body.get("description"))
                return None
            return body.get("result")
        except Exception as exc:
            log.warning("Telegram %s error: %s", method, exc)
            return None

    def on_photo(self, handler: Callable[[bytes, str], None]) -> None:
        """handler(image_bytes, chat_id) is called in a background thread for every photo the bot receives."""
        self._photo_handler = handler

    def download_file(self, file_id: str) -> bytes | None:
        info = self._api("getFile", file_id=file_id)
        if not info or not info.get("file_path"):
            return None
        try:
            return self._http.get(f"https://api.telegram.org/file/bot{self.token}/{info['file_path']}").content
        except Exception as exc:
            log.warning("Telegram file download failed: %s", exc)
            return None

    def reply(self, chat_id: str, text: str) -> None:
        if self.enabled and chat_id:
            self._api("sendMessage", chat_id=chat_id, text=text, parse_mode="HTML")

    def start(self, callback_handler: Callable[[str, str], str]) -> None:
        self._callback_handler = callback_handler
        if not self.enabled:
            return
        me = self._api("getMe")
        if not me:
            self.enabled, self.status, self.detail = False, "fallback", "Telegram token rejected — dashboard outbox only."
            return
        self.bot_username = me.get("username", "")
        threading.Thread(target=self._work, daemon=True, name="telegram-send").start()
        if settings.public_base_url and not settings.telegram_polling:
            self._api("setWebhook", url=f"{settings.public_base_url}/api/telegram/webhook")
        elif settings.telegram_polling:
            self._api("deleteWebhook")
            threading.Thread(target=self._poll, daemon=True, name="telegram-poll").start()
        self.detail = f"@{self.bot_username} · " + ("linked chat " + self.default_chat if self.default_chat else "send /start to link")

    def chat_for(self, role: str) -> str:
        if role == "supplier" and settings.telegram_supplier_chat_id:
            return settings.telegram_supplier_chat_id
        if role == "customer" and settings.telegram_customer_chat_id:
            return settings.telegram_customer_chat_id
        if role == "family" and settings.telegram_family_chat_id:
            return settings.telegram_family_chat_id
        return self.default_chat

    # ── sending ────────────────────────────────────────────────────────────
    def send(self, *, role: str, title: str, text: str, buttons: list[tuple[str, str]] | None = None,
             related_id: str = "") -> dict:
        """Record the message in the outbox and queue delivery. Returns the outbox row immediately."""
        chat_id = self.chat_for(role)
        will_deliver = bool(self.enabled and chat_id)
        row = {
            "message_id": store.next_id("MSG"),
            "timestamp": now_iso(),
            "channel": "telegram",
            "role": role,
            "chat_id": chat_id or "",
            "title": title,
            "text": text,
            "buttons": [{"label": label, "data": data} for label, data in (buttons or [])],
            "delivered": False,
            "will_deliver": will_deliver,
            "simulated": not will_deliver,
            "provider_message_id": None,
            "related_id": related_id,
            "response": "",
        }
        store.insert("Outbox", row)
        if will_deliver:
            self._jobs.put(("send", row["message_id"], ""))
        return row

    def _work(self) -> None:
        while True:
            kind, ref, note = self._jobs.get()
            try:
                if kind == "send":
                    self._deliver(ref)
                else:
                    self._close(ref, note)
            except Exception as exc:
                log.warning("Telegram job %s failed: %s", kind, exc)

    def _deliver(self, message_id: str) -> None:
        row = store.get("Outbox", message_id)
        payload = {"chat_id": row["chat_id"], "text": row["text"], "parse_mode": "HTML"}
        if row["buttons"]:
            payload["reply_markup"] = {"inline_keyboard": [[{"text": b["label"], "callback_data": b["data"]} for b in row["buttons"]]]}
        result = self._api("sendMessage", **payload)
        if not result:
            store.update("Outbox", message_id, {"simulated": True, "will_deliver": False})
            return
        store.update("Outbox", message_id, {"delivered": True, "provider_message_id": result.get("message_id")})
        current = store.get("Outbox", message_id)
        if current["response"]:  # decided before delivery finished — close it now
            self._close(message_id, current["response"])

    def resolve(self, related_id: str, note: str) -> None:
        """Remove inline buttons once a decision is made (in Telegram and in the outbox)."""
        for row in store.all("Outbox"):
            if row["related_id"] != related_id or not row["buttons"]:
                continue
            store.update("Outbox", row["message_id"], {"buttons": [], "response": note})
            if row.get("will_deliver"):
                self._jobs.put(("resolve", row["message_id"], note))

    def _close(self, message_id: str, note: str) -> None:
        row = store.get("Outbox", message_id)
        if not row or not row["provider_message_id"]:
            return  # not delivered yet; _deliver closes it once it lands
        self._api("editMessageReplyMarkup", chat_id=row["chat_id"], message_id=row["provider_message_id"],
                  reply_markup={"inline_keyboard": []})
        self._api("sendMessage", chat_id=row["chat_id"], text=f"☑️ {row['title']}: {note}",
                  reply_to_message_id=row["provider_message_id"])

    # ── inbound ────────────────────────────────────────────────────────────
    def handle_update(self, update: dict) -> None:
        if "callback_query" in update:
            query = update["callback_query"]
            data = query.get("data", "")
            who = (query.get("from") or {}).get("first_name", "telegram user")
            reply = self._callback_handler(data, who) if self._callback_handler else "OK"
            self._api("answerCallbackQuery", callback_query_id=query["id"], text=reply[:180])
        elif "message" in update:
            message = update["message"]
            chat_id = str(message["chat"]["id"])
            if not self.default_chat:
                self.default_chat = chat_id
                self.status, self.detail = "live", f"@{self.bot_username} · linked chat {chat_id}"
                log.info("Telegram chat linked: %s", chat_id)
            if message.get("photo") and self._photo_handler:
                file_id = message["photo"][-1]["file_id"]  # largest size
                self._api("sendMessage", chat_id=chat_id, text="📷 Got it — SAATHI is reading your photo…")

                def work(fid=file_id, cid=chat_id):
                    data = self.download_file(fid)
                    if data:
                        self._photo_handler(data, cid)

                threading.Thread(target=work, daemon=True).start()
                return
            if (message.get("text") or "").startswith("/start"):
                self._api("sendMessage", chat_id=chat_id,
                          text="🙏 Namaskara! SAATHI AI is linked to this chat. Approvals, purchase orders, reminders and alerts will arrive here.")

    def _poll(self) -> None:
        offset = None
        while True:
            params = {"timeout": 25, "allowed_updates": ["message", "callback_query"]}
            if offset:
                params["offset"] = offset
            updates = self._api("getUpdates", _client=self._poll_http, **params)
            if updates is None:
                time.sleep(3)
                continue
            for update in updates:
                offset = update["update_id"] + 1
                try:
                    self.handle_update(update)
                except Exception as exc:
                    log.warning("Telegram update failed: %s", exc)


telegram = TelegramClient()
