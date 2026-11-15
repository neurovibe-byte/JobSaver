from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    # --- Core ---
    secret_key: str = "change-me-in-production"
    access_token_minutes: int = 60 * 24 * 7
    data_dir: Path = BACKEND_DIR / "data"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # --- Detection ---
    # PPE model: a Hugging Face repo id ("owner/name") or a local .pt path.
    # Any class whose name starts with "no" (NO-Hardhat, no_helmet, ...) is treated
    # as a violation, so you can swap in any PPE-trained YOLO model.
    # Default: dedicated hard-hat model (classes Hardhat / NO-Hardhat). On a labelled test set
    # it found 89% of helmets and never mistook a bare head for a helmet. Smaller/faster:
    # keremberke/yolov8n-hard-hat-detection
    ppe_model: str = "keremberke/yolov8m-hard-hat-detection"
    # Classes to ignore even if they start with "no" (comma separated, normalised names).
    ppe_ignore_classes: str = "no_glove,no_goggles,no_mask,no_shoes"
    pose_model: str = "yolov8n-pose.pt"
    # Optional models, downloaded and loaded only when switched on in Settings.
    # Format: Hugging Face "owner/repo" (file best.pt), "owner/repo:file.pt", or a local .pt path.
    vest_model: str = "Hansung-Cho/yolov8-ppe-detection"
    fire_model: str = "rabahdev/fire-smoke-yolov8n"
    fire_confidence: float = 0.45
    device: str = "auto"  # "auto", "cpu", "mps" (Apple GPU) or "0" (first CUDA GPU)
    detect_fps: float = 3.0  # how many frames per second are analysed per camera
    ppe_confidence: float = 0.25
    # Helmet rule: every clearly visible person whose head has no helmet on it is a violation.
    helmet_check: bool = True
    helmet_person_confidence: float = 0.5  # ignore faint/uncertain person detections
    pose_confidence: float = 0.25  # people lying down are detected with low confidence
    # A violation must be seen in this many consecutive analysed frames before it is recorded.
    min_consecutive_hits: int = 3
    # Seconds before the same violation type is recorded again for the same camera.
    event_cooldown_seconds: int = 60
    # A person must stay "down" (horizontal) this long to raise an emergency.
    person_down_seconds: float = 4.0

    # --- Telegram ---
    telegram_bot_token: str = ""
    telegram_chat_ids: str = ""  # comma separated chat ids

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def chat_id_list(self) -> list[str]:
        return [c.strip() for c in self.telegram_chat_ids.split(",") if c.strip()]

    @property
    def snapshots_dir(self) -> Path:
        return self.data_dir / "snapshots"

    @property
    def videos_dir(self) -> Path:
        return self.data_dir / "videos"

    @property
    def models_dir(self) -> Path:
        return self.data_dir / "models"


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    for d in (s.data_dir, s.snapshots_dir, s.videos_dir, s.models_dir):
        d.mkdir(parents=True, exist_ok=True)
    if s.secret_key == "change-me-in-production":
        # No SECRET_KEY in .env: generate one once and keep it so logins survive restarts.
        import secrets

        key_file = s.data_dir / "secret.key"
        if not key_file.exists():
            key_file.write_text(secrets.token_urlsafe(48))
        s.secret_key = key_file.read_text().strip()
    return s
