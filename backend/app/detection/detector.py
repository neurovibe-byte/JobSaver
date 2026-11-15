"""Frame analysis. All models are free and pretrained (no training needed to start):

  * helmet model -> Hugging Face keremberke/yolov8m-hard-hat-detection   (no_helmet)
  * pose model   -> Ultralytics yolov8n-pose (COCO keypoints)            (person_down, restricted_zone,
                                                                          and finding heads/torsos)
  * optional, loaded only when switched on in Settings:
      vest model -> Hugging Face Hansung-Cho/yolov8-ppe-detection         (no_vest)
      fire model -> Hugging Face rabahdev/fire-smoke-yolov8n              (fire)
"""

from __future__ import annotations

import logging
import math
import re
import threading
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np

from ..config import Settings

log = logging.getLogger("jobsaver.detector")

# Normalised model class name -> our violation type key
ALIASES = {
    "no_hardhat": "no_helmet",
    "no_hard_hat": "no_helmet",
    "no_helmet": "no_helmet",
    "no_safety_vest": "no_vest",
    "no_vest": "no_vest",
    "no_safety_helmet": "no_helmet",
}

# COCO keypoint indexes
L_SHOULDER, R_SHOULDER, L_HIP, R_HIP = 5, 6, 11, 12
HEAD = [0, 1, 2, 3, 4]

VEST_CLASSES = {"safety_vest", "vest", "hi_vis_vest", "reflective_vest"}
FIRE_CLASSES = {"fire", "flame", "smoke"}

RED = (60, 60, 230)
GREEN = (90, 190, 90)
GREY = (200, 200, 200)


HELMET_CLASSES = {"helmet", "hardhat", "hard_hat", "safety_helmet"}


def overlap(a, b) -> float:
    """Intersection over the smaller box's area (0..1)."""
    x1, y1, x2, y2 = max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])
    inter = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    small = min((a[2] - a[0]) * (a[3] - a[1]), (b[2] - b[0]) * (b[3] - b[1]))
    return inter / small if small > 0 else 0.0


def head_box(kp: np.ndarray | None, person: list[float], min_conf: float = 0.5):
    """Region where a helmet would be, from face keypoints (nose, eyes, ears).

    Returns None when fewer than 2 face points are visible (e.g. person facing away),
    because then we can't judge reliably and would rather not raise a false alarm.
    """
    if kp is None or kp.shape[0] < 7:
        return None
    face = kp[:5]
    face = face[face[:, 2] > min_conf]
    if len(face) < 2:
        return None
    xs, ys = face[:, 0], face[:, 1]
    size = max(xs.max() - xs.min(), ys.max() - ys.min()) * 1.8
    sh = kp[5:7]
    sh = sh[sh[:, 2] > min_conf]
    if len(sh) == 2:
        size = max(size, abs(sh[0, 0] - sh[1, 0]) * 0.55)
    size = max(size, (person[2] - person[0]) * 0.15, 16)
    cx = float(xs.mean())
    top = float(ys.min()) - size * 0.95  # helmets sit well above the eyes
    bottom = float(ys.max()) + size * 0.35
    x1 = max(person[0], cx - size * 0.65)
    x2 = min(person[2], cx + size * 0.65)
    return (x1, max(0.0, top), x2, bottom)


def foot_point(kp: np.ndarray | None, person: list[float], min_conf: float = 0.5) -> tuple[float, float]:
    """Where the person stands: ankles if visible, otherwise bottom-centre of the box."""
    if kp is not None and kp.shape[0] >= 17:
        ankles = kp[15:17]
        ankles = ankles[ankles[:, 2] > min_conf]
        if len(ankles):
            return float(ankles[:, 0].mean()), float(ankles[:, 1].max())
    return (person[0] + person[2]) / 2, person[3]


def torso_box(kp: np.ndarray | None, min_conf: float = 0.5):
    """Shoulders-to-hips region (where a vest is). None unless both shoulders are visible."""
    if kp is None or kp.shape[0] < 13:
        return None
    sh = kp[5:7]
    if (sh[:, 2] <= min_conf).any():
        return None
    hips = kp[11:13]
    hips = hips[hips[:, 2] > min_conf]
    x1, x2 = float(sh[:, 0].min()), float(sh[:, 0].max())
    width = max(x2 - x1, 10.0)
    top = float(sh[:, 1].min())
    bottom = float(hips[:, 1].max()) if len(hips) else top + width * 1.3
    return (x1 - width * 0.15, top - width * 0.1, x2 + width * 0.15, bottom)


def normalise(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


@dataclass
class Box:
    xyxy: tuple[int, int, int, int]
    label: str
    conf: float
    bad: bool  # draw red


@dataclass
class Analysis:
    violations: dict[str, float] = field(default_factory=dict)  # type -> best confidence
    person_down: float = 0.0  # best confidence of a person lying down, 0 if none
    persons: int = 0
    boxes: list[Box] = field(default_factory=list)
    zone: list[tuple[int, int]] | None = None  # danger zone polygon in pixels (for drawing)


def draw(frame: np.ndarray, boxes: list[Box], zone: list[tuple[int, int]] | None = None) -> np.ndarray:
    if zone and len(zone) >= 3:
        pts = np.array(zone, dtype=np.int32)
        overlay = frame.copy()
        cv2.fillPoly(overlay, [pts], (40, 40, 200))
        cv2.addWeighted(overlay, 0.18, frame, 0.82, 0, dst=frame)
        cv2.polylines(frame, [pts], True, (40, 40, 220), 2, cv2.LINE_AA)
    for b in boxes:
        x1, y1, x2, y2 = b.xyxy
        color = RED if b.bad else (GREEN if b.label else GREY)
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 3 if b.bad else 2)
        if b.label:
            text = f"{b.label} {b.conf:.0%}"
            scale = max(0.55, frame.shape[1] / 1600)
            (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, scale, 2)
            ty = y1 if y1 - th - 10 >= 0 else y1 + th + 10  # no room above -> draw inside
            cv2.rectangle(frame, (x1, ty - th - 10), (x1 + tw + 10, ty), color, -1)
            cv2.putText(frame, text, (x1 + 5, ty - 6), cv2.FONT_HERSHEY_SIMPLEX, scale,
                        (255, 255, 255), 2, cv2.LINE_AA)
    return frame


class Detector:
    def __init__(self, settings: Settings):
        self.s = settings
        self.ppe = None
        self.pose = None
        self.ready = False
        self.error: str | None = None
        self.device = "cpu"
        self._lock = threading.Lock()  # YOLO models aren't thread-safe
        self.ignore = {normalise(c) for c in settings.ppe_ignore_classes.split(",") if c.strip()}
        self.optional: dict[str, object] = {}  # "no_vest" / "fire" -> YOLO model
        self.optional_state: dict[str, str] = {}  # off | loading | ready | error: ...

    # ---------- loading ----------
    def resolve_model(self, spec: str) -> str:
        """Local .pt path, or Hugging Face "owner/repo" (file best.pt) or "owner/repo:file.pt"."""
        if spec.endswith(".pt") and ":" not in spec or Path(spec).exists():
            return spec
        repo, _, filename = spec.partition(":")
        filename = filename or "best.pt"
        target = self.s.models_dir / repo.replace("/", "__") / filename
        if target.exists():
            return str(target)
        target.parent.mkdir(parents=True, exist_ok=True)
        log.info("Downloading model %s (%s) from Hugging Face ...", repo, filename)
        try:
            from huggingface_hub import hf_hub_download

            return hf_hub_download(repo_id=repo, filename=filename, local_dir=target.parent)
        except Exception as e:  # e.g. Xet CDN blocked -> plain HTTPS fallback
            log.warning("hf_hub_download failed (%s); trying direct download", e)
            import httpx

            url = f"https://huggingface.co/{repo}/resolve/main/{filename}"
            tmp = target.with_suffix(".part")
            with httpx.stream("GET", url, follow_redirects=True, timeout=120) as r:
                r.raise_for_status()
                with tmp.open("wb") as f:
                    for chunk in r.iter_bytes(1 << 20):
                        f.write(chunk)
            tmp.rename(target)
            return str(target)

    def ensure_optional(self, enabled: set[str]) -> None:
        """Load the optional models (vest, fire) in the background the first time they're enabled."""
        for key, spec in (("no_vest", self.s.vest_model), ("fire", self.s.fire_model)):
            if key in enabled and self.optional_state.get(key) in (None, "off"):
                self.optional_state[key] = "loading"
                threading.Thread(target=self._load_optional, args=(key, spec), daemon=True,
                                 name=f"load-{key}").start()

    def _load_optional(self, key: str, spec: str) -> None:
        try:
            from ultralytics import YOLO

            model = YOLO(self.resolve_model(spec))
            log.info("Optional model %s loaded, classes: %s", key, model.names)
            self.optional[key] = model
            self.optional_state[key] = "ready"
        except Exception as e:
            log.exception("Failed to load optional model %s", key)
            self.optional_state[key] = f"error: {type(e).__name__}: {e}"

    def _pick_device(self) -> str:
        if self.s.device != "auto":
            return self.s.device
        import torch

        if torch.cuda.is_available():
            return "0"
        if torch.backends.mps.is_available():
            return "mps"
        return "cpu"

    def load(self) -> None:
        from ultralytics import YOLO

        self.device = self._pick_device()

        errors = []
        try:
            self.ppe = YOLO(self.resolve_model(self.s.ppe_model))
            log.info("PPE model classes: %s", self.ppe.names)
        except Exception as e:
            errors.append(f"PPE model: {type(e).__name__}: {e}")
            log.exception("Failed to load PPE model")
        try:
            pose_path = self.s.pose_model
            if not Path(pose_path).is_absolute() and not Path(pose_path).exists():
                pose_path = str(self.s.models_dir / pose_path)  # ultralytics downloads it here
            self.pose = YOLO(pose_path)
        except Exception as e:
            errors.append(f"Pose model: {type(e).__name__}: {e}")
            log.exception("Failed to load pose model")

        self.error = "; ".join(errors) or None
        if self.ppe or self.pose:
            try:  # warm-up so the first real frame isn't slow
                self.analyse(np.zeros((480, 640, 3), dtype=np.uint8), _force=True)
                self.ready = True
                log.info("Detector ready (ppe=%s, pose=%s, device=%s)",
                         bool(self.ppe), bool(self.pose), self.device)
            except Exception as e:
                self.error = f"Warm-up failed: {e}"
                log.exception("Detector warm-up failed")

    # ---------- inference ----------
    def _predict(self, model, frame, conf, **kw):
        return model.predict(frame, conf=conf, device=self.device, verbose=False, **kw)[0]

    def analyse(self, frame: np.ndarray, enabled: set[str] | None = None,
                zone: list[list[float]] | None = None, _force: bool = False) -> Analysis:
        """enabled: detection keys to run (None = the default set); zone: polygon, 0..1 coords."""
        out = Analysis()
        if not (self.ready or _force):
            return out
        if enabled is None:
            enabled = {"no_helmet", "person_down", "restricted_zone"}
        vest_model = self.optional.get("no_vest") if "no_vest" in enabled else None
        fire_model = self.optional.get("fire") if "fire" in enabled else None
        check_helmets = self.ppe is not None and self.s.helmet_check and "no_helmet" in enabled

        with self._lock:
            ppe_res = self._predict(self.ppe, frame, self.s.ppe_confidence) if check_helmets else None
            pose_res = self._predict(self.pose, frame, self.s.pose_confidence, classes=[0]) if self.pose else None
            vest_res = self._predict(vest_model, frame, self.s.ppe_confidence) if vest_model else None
            fire_res = self._predict(fire_model, frame, self.s.fire_confidence) if fire_model else None

        def boxes_of(res, wanted: set[str] | None = None, alias: str | None = None):
            if res is None:
                return []
            items = []
            b = res.boxes
            for xyxy, cls, conf in zip(b.xyxy.tolist(), b.cls.tolist(), b.conf.tolist(), strict=True):
                key = normalise(res.names[int(cls)])
                if (wanted is None or key in wanted) and (alias is None or ALIASES.get(key) == alias):
                    items.append((xyxy, conf, res.names[int(cls)]))
            return items

        helmets = boxes_of(ppe_res, HELMET_CLASSES)
        bare = boxes_of(ppe_res, alias="no_helmet")  # model's own "no helmet" detections
        vests = boxes_of(vest_res, VEST_CLASSES)
        no_vests = boxes_of(vest_res, alias="no_vest")

        kps = None
        persons: list[tuple[list[float], float]] = []
        if pose_res is not None and pose_res.boxes is not None and len(pose_res.boxes):
            kps = pose_res.keypoints.data.cpu().numpy() if pose_res.keypoints is not None else None
            persons = list(zip(pose_res.boxes.xyxy.tolist(), pose_res.boxes.conf.tolist(), strict=False))

        h, w = frame.shape[:2]
        zone_px = None
        if "restricted_zone" in enabled and zone and len(zone) >= 3:
            zone_px = [(int(x * w), int(y * h)) for x, y in zone]
            out.zone = zone_px
        zone_np = np.array(zone_px, dtype=np.int32) if zone_px else None

        def add(vtype: str, conf: float) -> None:
            out.violations[vtype] = max(out.violations.get(vtype, 0.0), conf)

        used_helmets: set[int] = set()
        used_bare: set[int] = set()
        for i, (xyxy, conf) in enumerate(persons):
            out.persons += 1
            kp = kps[i] if kps is not None else None
            clear = conf >= self.s.helmet_person_confidence  # clearly visible person
            flags: list[str] = []

            if "person_down" in enabled and self._is_down(xyxy, kp):
                out.person_down = max(out.person_down, conf)
                flags.append("PERSON DOWN")

            # Danger zone: the person's feet (ankles, or bottom of the box) inside the polygon
            if zone_np is not None:
                fx, fy = foot_point(kp, xyxy)
                if cv2.pointPolygonTest(zone_np, (fx, fy), False) >= 0:
                    add("restricted_zone", conf)
                    flags.append("DANGER ZONE")

            # Helmet: find the head from face keypoints, then look for a helmet on it.
            head = head_box(kp, xyxy) if (check_helmets and clear) else None
            if head is not None:
                h_idx = [j for j, (hb, _, _) in enumerate(helmets) if overlap(head, hb) > 0.25]
                b_idx = [j for j, (bb, _, _) in enumerate(bare) if overlap(head, bb) > 0.25]
                used_helmets.update(h_idx)
                used_bare.update(b_idx)
                helmet_conf = max((helmets[j][1] for j in h_idx), default=0.0)
                bare_conf = max((bare[j][1] for j in b_idx), default=0.0)
                if helmet_conf > bare_conf:
                    out.boxes.append(Box(tuple(map(int, head)), "HELMET", helmet_conf, False))
                else:
                    vconf = bare_conf or conf
                    add("no_helmet", vconf)
                    out.boxes.append(Box(tuple(map(int, head)), "NO HELMET", vconf, True))

            # Vest: something vest-like on the torso, otherwise a violation (torso must be visible)
            torso = torso_box(kp) if (vest_model is not None and clear) else None
            if torso is not None:
                vest_conf = max((c for vb, c, _ in vests if overlap(torso, vb) > 0.3), default=0.0)
                nov_conf = max((c for vb, c, _ in no_vests if overlap(torso, vb) > 0.3), default=0.0)
                if vest_conf > nov_conf:
                    out.boxes.append(Box(tuple(map(int, torso)), "VEST", vest_conf, False))
                else:
                    vconf = nov_conf or conf * 0.9
                    add("no_vest", vconf)
                    out.boxes.append(Box(tuple(map(int, torso)), "NO VEST", vconf, True))

            label = " | ".join(flags)
            out.boxes.append(Box(tuple(map(int, xyxy)), label, conf, bool(flags)))

        # helmet-model detections not matched to a pose person (e.g. people far away)
        for j, (bb, c, _) in enumerate(bare):
            if j not in used_bare and c >= self.s.ppe_confidence + 0.15:
                add("no_helmet", c)
                out.boxes.append(Box(tuple(map(int, bb)), "NO HELMET", c, True))
        for j, (hb, c, _) in enumerate(helmets):
            if j not in used_helmets and c >= 0.5:  # not on anyone's head: only show if sure
                out.boxes.append(Box(tuple(map(int, hb)), "HELMET", c, False))

        # Fire / smoke anywhere in the frame
        for fb, c, raw in boxes_of(fire_res, FIRE_CLASSES):
            add("fire", c)
            out.boxes.append(Box(tuple(map(int, fb)), raw.upper(), c, True))
        return out

    @staticmethod
    def _is_down(xyxy: list[float], kp: np.ndarray | None, min_kp_conf: float = 0.5) -> bool:
        """Lying down = the body axis (shoulders/head -> hips) is close to horizontal.

        If the hips (or both shoulders and head) aren't visible we can't tell, so we
        say "not down" rather than guessing from the box shape, because people cut off
        by the frame edge have wide boxes and caused false alarms.
        """
        if kp is None or kp.shape[0] < 13:
            return False

        def centre(idx: list[int]) -> np.ndarray | None:
            pts = kp[idx]
            pts = pts[pts[:, 2] > min_kp_conf]
            return pts[:, :2].mean(axis=0) if len(pts) else None

        upper = centre([L_SHOULDER, R_SHOULDER])
        if upper is None:
            upper = centre(HEAD)
        hips = centre([L_HIP, R_HIP])
        if upper is None or hips is None:
            return False
        dx, dy = abs(hips[0] - upper[0]), abs(hips[1] - upper[1])
        x1, y1, x2, y2 = xyxy
        if math.hypot(dx, dy) < 0.08 * math.hypot(x2 - x1, y2 - y1):
            return False  # degenerate / keypoints on top of each other
        return math.degrees(math.atan2(dx, dy)) > 60
