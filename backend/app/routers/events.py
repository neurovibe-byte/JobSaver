from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlmodel import Session, func, select

from ..auth import current_user
from ..config import get_settings
from ..db import get_session
from ..events import record_event
from ..models import Camera, Event, User
from ..settings_store import store
from .telegram import public_status

router = APIRouter(prefix="/api", tags=["events"], dependencies=[Depends(current_user)])


@router.get("/events")
def list_events(
    category: str | None = Query(default=None, pattern="^(violation|emergency)$"),
    type: str | None = Query(default=None, max_length=40),
    limit: int = Query(default=50, le=500),
    before_id: int | None = None,
    session: Session = Depends(get_session),
):
    q = select(Event).order_by(Event.id.desc()).limit(limit)
    if category:
        q = q.where(Event.category == category)
    if type:
        q = q.where(Event.type == type)
    if before_id:
        q = q.where(Event.id < before_id)
    return session.exec(q).all()


@router.post("/events/{event_id}/ack")
def acknowledge(event_id: int, session: Session = Depends(get_session)):
    ev = session.get(Event, event_id)
    if not ev:
        raise HTTPException(404, "Event not found")
    ev.acknowledged = True
    session.add(ev)
    session.commit()
    session.refresh(ev)
    return ev


@router.get("/events/{event_id}/snapshot.jpg")
def event_snapshot(event_id: int, session: Session = Depends(get_session)):
    ev = session.get(Event, event_id)
    if not ev or not ev.snapshot:
        raise HTTPException(404, "No snapshot")
    path = get_settings().snapshots_dir / ev.snapshot
    if not path.exists():
        raise HTTPException(404, "Snapshot file missing")
    return FileResponse(path, media_type="image/jpeg")


class SosIn(BaseModel):
    camera_id: int | None = None
    note: str | None = Field(default=None, max_length=500)


@router.post("/events/sos", status_code=201)
def sos(body: SosIn, request: Request, session: Session = Depends(get_session),
        user: User = Depends(current_user)):
    """Manual emergency alert from the dashboard (also goes to Telegram)."""
    name, location, frame = "", "", None
    if body.camera_id:
        cam = session.get(Camera, body.camera_id)
        name = cam.name if cam else ""
        location = cam.location if cam else ""
        w = request.app.state.cameras.get(body.camera_id)
        if w and w.jpeg:
            import cv2
            import numpy as np

            frame = cv2.imdecode(np.frombuffer(w.jpeg, np.uint8), cv2.IMREAD_COLOR)
    note = f"{user.name}: {body.note}" if body.note else user.name
    return record_event(event_type="sos", camera_id=body.camera_id, camera_name=name, location=location,
                        frame=frame, note=note)


@router.get("/stats")
def stats(request: Request, type: str | None = Query(default=None, max_length=40),
          session: Session = Depends(get_session)):
    """Dashboard numbers. With ?type=no_helmet everything is limited to that event type."""
    now = datetime.now(UTC)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = day_start - timedelta(days=6)

    tf = (Event.type == type,) if type else ()

    def count(*where) -> int:
        return session.exec(select(func.count()).select_from(Event).where(*where, *tf)).one()

    by_type = session.exec(
        select(Event.type, func.count()).where(Event.created_at >= week_start).group_by(Event.type)
    ).all()
    daily_rows = session.exec(
        select(func.date(Event.created_at), Event.category, func.count())
        .where(Event.created_at >= week_start, *tf)
        .group_by(func.date(Event.created_at), Event.category)
    ).all()
    daily = {(week_start + timedelta(days=i)).date().isoformat(): {"violation": 0, "emergency": 0}
             for i in range(7)}
    for d, cat, n in daily_rows:
        if str(d) in daily:
            daily[str(d)][cat] = n

    cams = session.exec(select(Camera)).all()
    mgr = request.app.state.cameras
    det = request.app.state.detector
    return {
        "cameras_total": len(cams),
        "cameras_online": sum(1 for c in cams if mgr.status(c.id)["status"] == "online"),
        "violations_today": count(Event.category == "violation", Event.created_at >= day_start),
        "emergencies_today": count(Event.category == "emergency", Event.created_at >= day_start),
        "open_violations": count(Event.category == "violation", Event.acknowledged == False),  # noqa: E712
        "open_emergencies": count(Event.category == "emergency", Event.acknowledged == False),  # noqa: E712
        "by_type": {t: n for t, n in by_type},
        "daily": [{"date": d, **v} for d, v in daily.items()],
        "detector": {"ready": det.ready, "error": det.error},
        "telegram": public_status()["active"],
        "enabled_detections": sorted(store.enabled_detections()),
    }
