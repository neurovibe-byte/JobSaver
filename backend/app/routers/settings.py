from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from ..auth import current_user
from ..settings_store import DETECTIONS, store
from .telegram import public_status

router = APIRouter(prefix="/api/settings", tags=["settings"], dependencies=[Depends(current_user)])


def _out(request: Request) -> dict:
    data = store.all()
    det = request.app.state.detector
    detections = []
    for key, info in DETECTIONS.items():
        state = "ready" if det.ready else "loading"
        if info.get("optional"):
            state = det.optional_state.get(key, "off") if data["detections"].get(key) else "off"
        detections.append({"key": key, "category": info["category"], "optional": bool(info.get("optional")),
                           "enabled": bool(data["detections"].get(key)), "model_state": state})
    return {"organization": data.get("organization", ""), "detections": detections,
            "telegram": public_status()}


@router.get("")
def get_settings(request: Request):
    return _out(request)


class SettingsIn(BaseModel):
    organization: str | None = Field(default=None, max_length=200)
    detections: dict[str, bool] | None = None


@router.put("")
def update_settings(body: SettingsIn, request: Request):
    patch: dict = {}
    if body.organization is not None:
        patch["organization"] = body.organization.strip()
    if body.detections:
        patch["detections"] = {k: v for k, v in body.detections.items() if k in DETECTIONS}
    store.update(patch)
    # start downloading/loading optional models right away instead of on the next frame
    request.app.state.detector.ensure_optional(store.enabled_detections())
    return _out(request)
