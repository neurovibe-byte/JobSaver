"""Telegram alerts via the free Bot API (create a bot with @BotFather)."""

from __future__ import annotations

import logging
import queue
import threading
from pathlib import Path

import httpx

log = logging.getLogger("jobsaver.telegram")
API = "https://api.telegram.org/bot{token}/{method}"

LABELS = {
    "no_helmet": "No helmet",
    "no_vest": "No safety vest",
    "no_mask": "No mask",
    "no_goggles": "No goggles",
    "no_glove": "No gloves",
    "no_shoes": "No safety shoes",
    "restricted_zone": "Danger zone entry",
    "fire": "Fire or smoke",
    "person_down": "Person down",
    "sos": "SOS",
}


def label(event_type: str) -> str:
    return LABELS.get(event_type, event_type.replace("_", " ").capitalize())


def _cfg() -> dict:
    from .settings_store import store  # late import: store imports the DB layer

    return store.telegram()


def call(method: str, token: str | None = None, **kwargs) -> dict:
    token = token or _cfg().get("token")
    if not token:
        raise RuntimeError("Telegram bot token is not set")
    r = httpx.post(API.format(token=token, method=method), timeout=20, **kwargs)
    data = r.json()
    if not data.get("ok"):
        raise RuntimeError(data.get("description", f"HTTP {r.status_code}"))
    return data["result"]


def send(text: str, photo: Path | None = None, chat_ids: list[str] | None = None) -> int:
    """Send to every configured chat. Returns the number of chats that received it."""
    ok = 0
    for chat_id in chat_ids or [str(c["id"]) for c in _cfg().get("chats", [])]:
        try:
            if photo and photo.exists():
                with photo.open("rb") as f:
                    call("sendPhoto", data={"chat_id": chat_id, "caption": text, "parse_mode": "HTML"},
                         files={"photo": f})
            else:
                call("sendMessage", data={"chat_id": chat_id, "text": text, "parse_mode": "HTML"})
            ok += 1
        except Exception as e:
            log.warning("Telegram send to %s failed: %s", chat_id, e)
    return ok


class Notifier:
    """Background sender so camera threads never block on the network."""

    def __init__(self):
        self.q: queue.Queue = queue.Queue(maxsize=200)
        threading.Thread(target=self._run, daemon=True, name="telegram").start()

    @property
    def enabled(self) -> bool:
        c = _cfg()
        return bool(c.get("enabled") and c.get("token") and c.get("chats"))

    def notify(self, text: str, photo: Path | None, on_sent=None) -> None:
        if not self.enabled:
            return
        try:
            self.q.put_nowait((text, photo, on_sent))
        except queue.Full:
            log.warning("Telegram queue full, dropping alert")

    def _run(self) -> None:
        while True:
            text, photo, on_sent = self.q.get()
            if send(text, photo) and on_sent:
                on_sent()


notifier = Notifier()
