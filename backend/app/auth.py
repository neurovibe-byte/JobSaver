from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session

from .config import get_settings
from .db import get_session
from .models import User

ALGORITHM = "HS256"
bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode()[:72], bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode()[:72], hashed.encode())


def create_token(user_id: int) -> str:
    s = get_settings()
    exp = datetime.now(UTC) + timedelta(minutes=s.access_token_minutes)
    return jwt.encode({"sub": str(user_id), "exp": exp}, s.secret_key, algorithm=ALGORITHM)


def user_from_token(raw: str | None, session: Session) -> User | None:
    if not raw:
        return None
    try:
        payload = jwt.decode(raw, get_settings().secret_key, algorithms=[ALGORITHM])
        return session.get(User, int(payload["sub"]))
    except (jwt.PyJWTError, KeyError, ValueError):
        return None


def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    token: str | None = Query(default=None, description="For <img> tags that can't send headers"),
    session: Session = Depends(get_session),
) -> User:
    raw = creds.credentials if creds else token
    if not raw:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    user = user_from_token(raw, session)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    return user
