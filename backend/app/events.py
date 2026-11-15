"""Creating events: snapshot to disk -> row in DB -> Telegram alert."""

from __future__ import annotations

import html
import uuid

import cv2
import numpy as np
from sqlmodel import Session

from .config import get_settings
from .db import engine
from .models import Event, as_utc
from .settings_store import store
from .telegram import label, notifier

EMERGENCY_TYPES = {"person_down", "fire", "sos"}


def _mark_notified(event_id: int) -> None:
    with Session(engine) as s:
        ev = s.get(Event, event_id)
        if ev:
            ev.notified = True
            s.add(ev)
            s.commit()


SEVERITY = {"violation": "⚠️", "emergency": "🚨"}


def build_caption(ev: Event, organization: str) -> str:
    """Telegram message for an event (HTML)."""
    e = html.escape
    icon = SEVERITY.get(ev.category, "⚠️")
    kind = "EMERGENCY" if ev.category == "emergency" else "Safety violation"
    when = as_utc(ev.created_at).astimezone()
    lines = [f"{icon} <b>{e(label(ev.type))}</b>", f"<i>{kind}</i>", ""]
    if organization:
        lines.append(f"🏢 {e(organization)}")
    lines.append(f"📷 Camera: <b>{e(ev.camera_name or '—')}</b>")
    if ev.location:
        lines.append(f"📍 Location: {e(ev.location)}")
    lines.append(f"📅 {when:%d.%m.%Y}   🕒 {when:%H:%M:%S} ({when:%Z})")
    if ev.confidence:
        lines.append(f"🎯 Confidence: {ev.confidence:.0%}")
    if ev.persons:
        lines.append(f"👥 People in frame: {ev.persons}")
    if ev.note:
        lines.append(f"📝 {e(ev.note)}")
    lines.append(f"🆔 Event #{ev.id}")
    return "\n".join(lines)


def record_event(
    *,
    event_type: str,
    camera_id: int | None,
    camera_name: str,
    location: str = "",
    persons: int = 0,
    confidence: float = 0.0,
    frame: np.ndarray | None = None,
    note: str | None = None,
) -> Event:
    settings = get_settings()
    snapshot = None
    if frame is not None:
        snapshot = f"{uuid.uuid4().hex}.jpg"
        cv2.imwrite(str(settings.snapshots_dir / snapshot), frame, [cv2.IMWRITE_JPEG_QUALITY, 85])

    category = "emergency" if event_type in EMERGENCY_TYPES else "violation"
    with Session(engine) as s:
        ev = Event(camera_id=camera_id, camera_name=camera_name, location=location or "", persons=persons,
                   category=category, type=event_type, confidence=round(confidence, 3),
                   snapshot=snapshot, note=note)
        s.add(ev)
        s.commit()
        s.refresh(ev)

    cfg = store.all()
    if event_type in cfg["telegram"].get("notify_types", []):
        eid = ev.id
        notifier.notify(build_caption(ev, cfg.get("organization", "")),
                        settings.snapshots_dir / snapshot if snapshot else None,
                        on_sent=lambda: _mark_notified(eid))
    return ev
