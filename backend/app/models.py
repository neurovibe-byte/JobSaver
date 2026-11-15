from datetime import UTC, datetime

from pydantic import field_serializer
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(UTC)


def as_utc(dt: datetime) -> datetime:
    """SQLite drops tzinfo; everything we store is UTC."""
    return dt.replace(tzinfo=UTC) if dt.tzinfo is None else dt


class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    email: str = Field(index=True, unique=True)
    password_hash: str
    created_at: datetime = Field(default_factory=utcnow)


class Setting(SQLModel, table=True):
    key: str = Field(primary_key=True)
    value: str  # JSON


class Camera(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    # "0" / "1" = local webcam index, rtsp://..., http://..., a video file path, or "browser"
    source: str
    location: str = ""  # free text, e.g. "Building A, Workshop 2"
    # danger zone polygon as JSON [[x, y], ...] with coordinates 0..1 relative to the frame
    zone: str | None = None
    enabled: bool = True
    created_at: datetime = Field(default_factory=utcnow)


class Event(SQLModel, table=True):
    """A recorded incident. category = "violation" (PPE etc.) or "emergency" (person down, SOS)."""

    id: int | None = Field(default=None, primary_key=True)
    camera_id: int | None = Field(default=None, index=True)
    camera_name: str = ""
    location: str = ""
    persons: int = 0
    category: str = Field(index=True)
    type: str  # no_helmet, no_vest, person_down, sos, ...
    confidence: float = 0.0
    snapshot: str | None = None  # filename inside data/snapshots
    note: str | None = None
    acknowledged: bool = False
    notified: bool = False
    created_at: datetime = Field(default_factory=utcnow, index=True)

    @field_serializer("created_at")
    def _ser_created(self, v: datetime) -> str:
        return as_utc(v).isoformat()
