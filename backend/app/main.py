import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from .cameras import CameraManager
from .config import get_settings
from .db import engine, init_db
from .detection.detector import Detector
from .models import Camera
from .routers import auth, cameras, events, settings, telegram

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    init_db()
    detector = Detector(settings)
    # Models can take a while to download the first time; video streams work meanwhile.
    threading.Thread(target=detector.load, daemon=True, name="model-loader").start()
    manager = CameraManager(detector)
    with Session(engine) as s:
        for cam in s.exec(select(Camera).where(Camera.enabled == True)):  # noqa: E712
            manager.start(cam.id, cam.name, cam.source, cam.location, cam.zone)
    app.state.detector = detector
    app.state.cameras = manager
    from .settings_store import store

    detector.ensure_optional(store.enabled_detections())  # vest/fire models if switched on
    yield
    manager.stop_all()


app = FastAPI(title="JobSaver API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
for r in (auth.router, cameras.router, cameras.ws_router, events.router, settings.router, telegram.router):
    app.include_router(r)


@app.get("/api/health")
def health():
    det = app.state.detector
    return {"ok": True, "detector_ready": det.ready, "detector_error": det.error}
