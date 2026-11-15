import asyncio
import json
import re
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from ..auth import current_user, user_from_token
from ..cameras import BROWSER_SOURCE, BrowserCamera, parse_zone
from ..config import get_settings
from ..db import engine, get_session
from ..models import Camera

router = APIRouter(prefix="/api/cameras", tags=["cameras"], dependencies=[Depends(current_user)])
# WebSockets can't use the HTTP bearer dependency, they authenticate with ?token=
ws_router = APIRouter(prefix="/api/cameras", tags=["cameras"])
MAX_FRAME_BYTES = 4 * 1024 * 1024

VIDEO_EXT = {".mp4", ".avi", ".mov", ".mkv", ".webm", ".m4v"}


class CameraIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    source: str = Field(min_length=1, max_length=1000)
    location: str = Field(default="", max_length=200)


class CameraPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    location: str | None = Field(default=None, max_length=200)
    enabled: bool | None = None
    # danger zone polygon, points as [x, y] in 0..1; empty list removes the zone
    zone: list[tuple[float, float]] | None = Field(default=None, max_length=50)


def _manager(request: Request):
    return request.app.state.cameras


def _out(cam: Camera, mgr) -> dict:
    is_upload = cam.source.startswith(str(get_settings().videos_dir))
    return {
        "id": cam.id,
        "name": cam.name,
        "source": "uploaded video" if is_upload else cam.source,
        "kind": "browser" if cam.source == BROWSER_SOURCE else "file" if is_upload else "stream",
        "location": cam.location or "",
        "zone": parse_zone(cam.zone),
        "enabled": cam.enabled,
        **mgr.status(cam.id),
    }


def _get(session: Session, cam_id: int) -> Camera:
    cam = session.get(Camera, cam_id)
    if not cam:
        raise HTTPException(404, "Camera not found")
    return cam


@router.get("")
def list_cameras(request: Request, session: Session = Depends(get_session)):
    mgr = _manager(request)
    return [_out(c, mgr) for c in session.exec(select(Camera).order_by(Camera.id))]


@router.post("", status_code=201)
def add_camera(body: CameraIn, request: Request, session: Session = Depends(get_session)):
    cam = Camera(name=body.name.strip(), source=body.source.strip(), location=body.location.strip())
    session.add(cam)
    session.commit()
    session.refresh(cam)
    _manager(request).start(cam.id, cam.name, cam.source, cam.location, cam.zone)
    return _out(cam, _manager(request))


@router.post("/upload", status_code=201)
async def upload_video(request: Request, name: str = Form(...), file: UploadFile = File(...),
                       location: str = Form(default=""), session: Session = Depends(get_session)):
    """Create a camera from a video file — handy for demos without real CCTV."""
    ext = ("." + file.filename.rsplit(".", 1)[-1].lower()) if file.filename and "." in file.filename else ""
    if ext not in VIDEO_EXT:
        raise HTTPException(400, f"Unsupported video type. Use one of: {', '.join(sorted(VIDEO_EXT))}")
    path = get_settings().videos_dir / f"{uuid.uuid4().hex}{ext}"
    with path.open("wb") as f:
        while chunk := await file.read(1 << 20):
            f.write(chunk)
    cam = Camera(name=name.strip() or re.sub(r"\.\w+$", "", file.filename), source=str(path),
                 location=location.strip()[:200])
    session.add(cam)
    session.commit()
    session.refresh(cam)
    _manager(request).start(cam.id, cam.name, cam.source, cam.location, cam.zone)
    return _out(cam, _manager(request))


@router.patch("/{cam_id}")
def update_camera(cam_id: int, body: CameraPatch, request: Request, session: Session = Depends(get_session)):
    cam = _get(session, cam_id)
    if body.name is not None:
        cam.name = body.name.strip()
    if body.location is not None:
        cam.location = body.location.strip()
    if body.zone is not None:
        cam.zone = json.dumps([[round(x, 4), round(y, 4)] for x, y in body.zone]) if len(body.zone) >= 3 else None
    toggled = body.enabled is not None and body.enabled != cam.enabled
    if body.enabled is not None:
        cam.enabled = body.enabled
    session.add(cam)
    session.commit()
    mgr = _manager(request)
    if toggled:
        if cam.enabled:
            mgr.start(cam.id, cam.name, cam.source, cam.location, cam.zone)
        else:
            mgr.stop(cam.id)
    else:  # rename / location / zone: apply live, keep the stream running
        mgr.update_meta(cam.id, cam.name, cam.location, cam.zone)
    return _out(cam, mgr)


@router.delete("/{cam_id}", status_code=204)
def delete_camera(cam_id: int, request: Request, session: Session = Depends(get_session)):
    cam = _get(session, cam_id)
    _manager(request).stop(cam.id)
    videos = get_settings().videos_dir
    if cam.source.startswith(str(videos)):
        (videos / cam.source.rsplit("/", 1)[-1]).unlink(missing_ok=True)
    session.delete(cam)
    session.commit()


@router.get("/{cam_id}/snapshot.jpg")
def snapshot(cam_id: int, request: Request):
    w = _manager(request).get(cam_id)
    if not w or not w.jpeg:
        raise HTTPException(404, "No frame yet")
    return Response(w.jpeg, media_type="image/jpeg", headers={"Cache-Control": "no-store"})


@router.get("/{cam_id}/stream")
async def stream(cam_id: int, request: Request):
    """MJPEG stream: use directly as <img src=".../stream?token=...">."""
    mgr = _manager(request)

    async def frames():
        last = -1
        while not await request.is_disconnected():
            w = mgr.get(cam_id)
            if w and w.jpeg and w.frame_id != last:
                last = w.frame_id
                yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + w.jpeg + b"\r\n")
            await asyncio.sleep(1 / 15)

    return StreamingResponse(frames(), media_type="multipart/x-mixed-replace; boundary=frame",
                             headers={"Cache-Control": "no-store"})


@ws_router.websocket("/{cam_id}/publish")
async def publish(ws: WebSocket, cam_id: int, token: str | None = None):
    """A browser streams its camera here: send JPEG frames as binary messages; after each
    frame the server answers "ok", and the client sends the next one (simple flow control)."""
    # accept first so the browser receives our close code (closing before accept = plain 403)
    await ws.accept()
    with Session(engine) as session:
        user = user_from_token(token, session)
    if not user:
        await ws.close(code=4401)
        return
    cam = ws.app.state.cameras.get(cam_id)
    if not isinstance(cam, BrowserCamera):
        await ws.close(code=4404)
        return
    old = cam.connect(ws)
    if old is not None:  # only one device can broadcast a given camera
        try:
            await old.close(code=4409)
        except Exception:
            pass
    try:
        while True:
            data = await ws.receive_bytes()
            if len(data) <= MAX_FRAME_BYTES:
                await run_in_threadpool(cam.push_jpeg, data)
            if cam.publisher is not ws or cam.status == "stopped":
                await ws.close(code=4409)
                break
            await ws.send_text("ok")
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        cam.disconnect(ws)
