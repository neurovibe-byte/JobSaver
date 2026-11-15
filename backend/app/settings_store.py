"""App settings editable from the UI (stored in the DB, cached in memory).

`.env` values are only used as initial defaults the first time.
"""

from __future__ import annotations

import copy
import json
import threading

from sqlmodel import Session

from .config import get_settings
from .db import engine
from .models import Setting

# Every detection the system can run. "optional" ones need an extra model download.
DETECTIONS = {
    "no_helmet": {"category": "violation", "default": True},
    "no_vest": {"category": "violation", "default": False, "optional": True},
    "restricted_zone": {"category": "violation", "default": True},
    "person_down": {"category": "emergency", "default": True},
    "fire": {"category": "emergency", "default": False, "optional": True},
}
EVENT_TYPES = [*DETECTIONS, "sos"]


def _defaults() -> dict:
    env = get_settings()
    return {
        "organization": "",
        "detections": {k: v["default"] for k, v in DETECTIONS.items()},
        "telegram": {
            "token": env.telegram_bot_token,
            "chats": [{"id": c, "name": ""} for c in env.chat_id_list],
            "enabled": True,
            "notify_types": list(EVENT_TYPES),
        },
    }


def _merge(base: dict, extra: dict) -> dict:
    out = copy.deepcopy(base)
    for k, v in extra.items():
        out[k] = _merge(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out


class SettingsStore:
    def __init__(self):
        self._lock = threading.Lock()
        self._data: dict | None = None

    def _load(self) -> dict:
        with Session(engine) as s:
            row = s.get(Setting, "app")
            stored = json.loads(row.value) if row else {}
        return _merge(_defaults(), stored)

    def all(self) -> dict:
        with self._lock:
            if self._data is None:
                self._data = self._load()
            return copy.deepcopy(self._data)

    def update(self, patch: dict) -> dict:
        with self._lock:
            data = _merge(self._data or self._load(), patch)
            with Session(engine) as s:
                row = s.get(Setting, "app") or Setting(key="app", value="{}")
                row.value = json.dumps(data)
                s.add(row)
                s.commit()
            self._data = data
            return copy.deepcopy(data)

    # convenience accessors
    def enabled_detections(self) -> set[str]:
        return {k for k, on in self.all()["detections"].items() if on}

    def telegram(self) -> dict:
        return self.all()["telegram"]


store = SettingsStore()
