"""Camera workers: get frames -> analyse -> record events -> keep latest annotated JPEG.

Two kinds of cameras:
  * CameraWorker  - a background thread pulls frames itself (webcam index, RTSP/HTTP URL, video file)
  * BrowserCamera - a browser (laptop or phone camera) pushes frames over a WebSocket
"""

from __future__ import annotations

import logging
import threading
import time
from pathlib import Path

import cv2
import numpy as np

from .config import get_settings
from .detection.detector import Analysis, Detector, draw
from .events import record_event
from .settings_store import store

log = logging.getLogger("jobsaver.cameras")

BROWSER_SOURCE = "browser"


def open_capture(source: str) -> tuple[cv2.VideoCapture, bool]:
    """Returns (capture, is_file). Digits = local webcam index."""
    if source.strip().isdigit():
        return cv2.VideoCapture(int(source)), False
    is_file = Path(source).exists()
    return cv2.VideoCapture(source), is_file


def parse_zone(zone: str | list | None) -> list[list[float]] | None:
    if not zone:
        return None
    if isinstance(zone, str):
        import json

        try:
            zone = json.loads(zone)
        except ValueError:
            return None
    pts = [[min(1.0, max(0.0, float(x))), min(1.0, max(0.0, float(y)))] for x, y in zone]
    return pts if len(pts) >= 3 else None


class FrameProcessor:
    """Shared per-camera state + detection rules, independent of where frames come from."""

    def __init__(self, cam_id: int, name: str, source: str, detector: Detector,
                 location: str = "", zone=None):
        self.cam_id, self.name, self.source = cam_id, name, source
        self.location = location or ""
        self.zone = parse_zone(zone)
        self.detector = detector
        self.s = get_settings()
        self.status = "connecting"  # connecting | online | offline | waiting | stopped
        self.error: str | None = None
        self.jpeg: bytes | None = None
        self.frame_id = 0
        self.last: Analysis = Analysis()
        self._last_detect = 0.0
        self._hits: dict[str, int] = {}
        self._last_event: dict[str, float] = {}
        self._down_since: float | None = None

    def process(self, frame: np.ndarray) -> None:
        now = time.monotonic()
        if self.detector.ready and now - self._last_detect >= 1 / max(self.s.detect_fps, 0.1):
            self._last_detect = now
            try:
                enabled = store.enabled_detections()
                self.detector.ensure_optional(enabled)
                self.last = self.detector.analyse(frame, enabled=enabled, zone=self.zone)
                self._evaluate(frame, self.last)
            except Exception:
                log.exception("Detection failed on camera %s", self.cam_id)

        # analyse full resolution; only the browser preview is downscaled
        annotated = self._resize(draw(frame.copy(), self.last.boxes, self.last.zone))
        ok, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 75])
        if ok:
            self.jpeg = buf.tobytes()
            self.frame_id += 1

    @staticmethod
    def _resize(frame: np.ndarray, max_w: int = 960) -> np.ndarray:
        h, w = frame.shape[:2]
        if w <= max_w:
            return frame
        return cv2.resize(frame, (max_w, int(h * max_w / w)))

    # ---------- rules ----------
    def _evaluate(self, frame: np.ndarray, a: Analysis) -> None:
        now = time.monotonic()
        # PPE violations: require N consecutive analysed frames to avoid flicker false positives
        for vtype in set(self._hits) | set(a.violations):
            if vtype in a.violations:
                self._hits[vtype] = self._hits.get(vtype, 0) + 1
                if self._hits[vtype] >= self.s.min_consecutive_hits:
                    self._fire(vtype, a.violations[vtype], frame, a, now)
            else:
                self._hits[vtype] = 0

        # Person down: must stay down for person_down_seconds
        if a.person_down:
            self._down_since = self._down_since or now
            if now - self._down_since >= self.s.person_down_seconds:
                self._fire("person_down", a.person_down, frame, a, now)
        else:
            self._down_since = None

    def _fire(self, vtype: str, conf: float, frame: np.ndarray, a: Analysis, now: float) -> None:
        if now - self._last_event.get(vtype, -1e9) < self.s.event_cooldown_seconds:
            return
        self._last_event[vtype] = now
        log.info("Camera %s: %s (%.2f)", self.name, vtype, conf)
        record_event(event_type=vtype, camera_id=self.cam_id, camera_name=self.name,
                     location=self.location, persons=a.persons, confidence=conf,
                     frame=draw(frame.copy(), a.boxes, a.zone))

    def stop(self) -> None:
        self.status = "stopped"


class CameraWorker(FrameProcessor, threading.Thread):
    def __init__(self, cam_id: int, name: str, source: str, detector: Detector, **meta):
        # Thread first: FrameProcessor sets .name, which Thread only allows after its own __init__
        threading.Thread.__init__(self, daemon=True, name=f"camera-{cam_id}")
        FrameProcessor.__init__(self, cam_id, name, source, detector, **meta)
        self._halt = threading.Event()

    def stop(self) -> None:
        self._halt.set()

    def run(self) -> None:
        while not self._halt.is_set():
            cap, is_file = open_capture(self.source)
            if not cap.isOpened():
                self.status, self.error = "offline", "Cannot open source"
                cap.release()
                self._halt.wait(5)
                continue
            self.status, self.error = "online", None
            self._loop(cap, is_file)
            cap.release()
            if not self._halt.is_set():
                self.status = "connecting"
                self._halt.wait(2)
        self.status = "stopped"

    def _loop(self, cap: cv2.VideoCapture, is_file: bool) -> None:
        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        frame_delay = 1 / fps if is_file and 1 <= fps <= 120 else 0
        fails = 0
        while not self._halt.is_set():
            t0 = time.monotonic()
            ok, frame = cap.read()
            if not ok:
                if is_file:  # loop demo videos
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    continue
                fails += 1
                if fails > 50:
                    self.error = "Stream lost"
                    return
                time.sleep(0.05)
                continue
            fails = 0
            self.process(frame)
            if frame_delay:
                time.sleep(max(0.0, frame_delay - (time.monotonic() - t0)))


class BrowserCamera(FrameProcessor):
    """Frames are pushed by a browser (getUserMedia) over a WebSocket."""

    def __init__(self, cam_id: int, name: str, source: str, detector: Detector, **meta):
        super().__init__(cam_id, name, source, detector, **meta)
        self.status = "waiting"  # until a device starts broadcasting
        self.publisher: object | None = None  # the websocket currently broadcasting
        self._lock = threading.Lock()  # one frame at a time

    def connect(self, ws: object) -> object | None:
        """Register a new publisher; returns the previous one (to be closed)."""
        old, self.publisher = self.publisher, ws
        self.status, self.error = "online", None
        return old

    def disconnect(self, ws: object) -> None:
        if self.publisher is ws:
            self.publisher = None
            if self.status != "stopped":
                self.status = "waiting"

    def push_jpeg(self, data: bytes) -> None:
        frame = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
        if frame is None:
            return
        with self._lock:
            self.process(frame)


class CameraManager:
    def __init__(self, detector: Detector):
        self.detector = detector
        self.workers: dict[int, FrameProcessor] = {}
        self._lock = threading.Lock()

    def start(self, cam_id: int, name: str, source: str, location: str = "", zone=None) -> None:
        with self._lock:
            self._stop_locked(cam_id)
            meta = {"location": location, "zone": zone}
            if source == BROWSER_SOURCE:
                self.workers[cam_id] = BrowserCamera(cam_id, name, source, self.detector, **meta)
            else:
                w = CameraWorker(cam_id, name, source, self.detector, **meta)
                self.workers[cam_id] = w
                w.start()

    def update_meta(self, cam_id: int, name: str, location: str, zone) -> None:
        """Rename / move / change zone without restarting the stream."""
        w = self.workers.get(cam_id)
        if w:
            w.name, w.location, w.zone = name, location or "", parse_zone(zone)

    def stop(self, cam_id: int) -> None:
        with self._lock:
            self._stop_locked(cam_id)

    def _stop_locked(self, cam_id: int) -> None:
        w = self.workers.pop(cam_id, None)
        if w:
            w.stop()

    def stop_all(self) -> None:
        with self._lock:
            for cid in list(self.workers):
                self._stop_locked(cid)

    def get(self, cam_id: int) -> FrameProcessor | None:
        return self.workers.get(cam_id)

    def status(self, cam_id: int) -> dict:
        w = self.workers.get(cam_id)
        if not w:
            return {"status": "stopped", "error": None, "persons": 0}
        return {"status": w.status, "error": w.error, "persons": w.last.persons}
