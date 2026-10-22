"""Small shared helpers: time, money formatting, logging."""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
# HTTP client INFO logs include full request URLs — the Telegram URL embeds the bot token.
for _noisy in ("httpx", "httpx2", "httpcore"):
    logging.getLogger(_noisy).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(f"saathi.{name}")


def now() -> datetime:
    return datetime.now().replace(microsecond=0)


def now_iso() -> str:
    return now().isoformat()


def today() -> date:
    return date.today()


def day_offset(days: int) -> str:
    return (today() + timedelta(days=days)).isoformat()


def inr(amount: float | int | None) -> str:
    """Indian-grouped rupee string: 125000 -> ₹1,25,000."""
    if amount is None:
        return "—"
    negative = amount < 0
    value = abs(round(float(amount)))
    digits = str(int(value))
    if len(digits) > 3:
        head, tail = digits[:-3], digits[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        digits = ",".join(groups + [tail])
    return f"{'-' if negative else ''}₹{digits}"


def pct(value: float) -> str:
    return f"{value:+.1f}%"


def clock12(hhmm: str) -> str:
    """'23:47' -> '11:47 PM'."""
    h, m = (int(x) for x in hhmm.split(":"))
    return f"{h % 12 or 12}:{m:02d} {'AM' if h < 12 else 'PM'}"
