"""Telegram setup from the UI: connect a bot token, pick chats, choose what to send, test."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .. import telegram
from ..auth import current_user
from ..settings_store import EVENT_TYPES, store

router = APIRouter(prefix="/api/telegram", tags=["telegram"], dependencies=[Depends(current_user)])


def public_status() -> dict:
    """Telegram config for the UI. The token itself is never sent back, only a masked hint."""
    c = store.telegram()
    token = c.get("token") or ""
    return {
        "connected": bool(token),
        "token_hint": f"…{token[-4:]}" if token else "",
        "bot": c.get("bot") or {},
        "chats": c.get("chats", []),
        "enabled": c.get("enabled", True),
        "notify_types": c.get("notify_types", list(EVENT_TYPES)),
        "active": bool(token and c.get("chats") and c.get("enabled", True)),
    }


@router.get("/status")
def status():
    return public_status()


class ConnectIn(BaseModel):
    token: str = Field(min_length=20, max_length=200)


@router.post("/connect")
def connect(body: ConnectIn):
    """Validate the token with Telegram (getMe) and save it."""
    token = body.token.strip()
    try:
        me = telegram.call("getMe", token=token)
    except Exception as e:
        raise HTTPException(400, f"Telegram rejected the token: {e}") from e
    bot = {"id": me.get("id"), "username": me.get("username"), "name": me.get("first_name")}
    store.update({"telegram": {"token": token, "bot": bot}})
    return public_status()


@router.post("/disconnect")
def disconnect():
    store.update({"telegram": {"token": "", "bot": {}, "chats": []}})
    return public_status()


@router.get("/chats/discover")
def discover_chats():
    """Chats that recently messaged the bot or added it to a group (Telegram keeps ~24h)."""
    try:
        updates = telegram.call("getUpdates", data={"allowed_updates": '["message","my_chat_member","channel_post"]'})
    except Exception as e:
        raise HTTPException(400, str(e)) from e
    found: dict[str, dict] = {}
    for u in updates:
        msg = u.get("message") or u.get("channel_post") or u.get("my_chat_member") or {}
        chat = msg.get("chat")
        if not chat:
            continue
        name = chat.get("title") or " ".join(filter(None, [chat.get("first_name"), chat.get("last_name")])) \
            or chat.get("username") or str(chat["id"])
        found[str(chat["id"])] = {"id": str(chat["id"]), "name": name, "type": chat.get("type", "")}
    saved = {str(c["id"]) for c in store.telegram().get("chats", [])}
    return [{**c, "added": c["id"] in saved} for c in found.values()]


class ChatIn(BaseModel):
    id: str = Field(min_length=1, max_length=40)
    name: str = Field(default="", max_length=200)


@router.post("/chats")
def add_chat(body: ChatIn):
    chats = [c for c in store.telegram().get("chats", []) if str(c["id"]) != body.id.strip()]
    chats.append({"id": body.id.strip(), "name": body.name.strip()})
    store.update({"telegram": {"chats": chats}})
    return public_status()


@router.delete("/chats/{chat_id}")
def remove_chat(chat_id: str):
    chats = [c for c in store.telegram().get("chats", []) if str(c["id"]) != chat_id]
    store.update({"telegram": {"chats": chats}})
    return public_status()


class PrefsIn(BaseModel):
    enabled: bool | None = None
    notify_types: list[str] | None = None


@router.put("/prefs")
def prefs(body: PrefsIn):
    patch: dict = {}
    if body.enabled is not None:
        patch["enabled"] = body.enabled
    if body.notify_types is not None:
        patch["notify_types"] = [t for t in body.notify_types if t in EVENT_TYPES]
    store.update({"telegram": patch})
    return public_status()


@router.post("/test")
def test():
    c = store.telegram()
    if not c.get("token"):
        raise HTTPException(400, "Connect a bot first")
    if not c.get("chats"):
        raise HTTPException(400, "Add at least one chat first")
    org = store.all().get("organization")
    text = "✅ <b>JobSaver</b>: test alert. Telegram notifications are working." + (f"\n🏢 {org}" if org else "")
    sent = telegram.send(text)
    if not sent:
        raise HTTPException(400, "Could not send. Make sure each chat has messaged the bot (or added it to the group).")
    return {"sent": sent, "total": len(c["chats"])}
