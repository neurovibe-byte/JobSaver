from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlmodel import Session, select

from ..auth import create_token, current_user, hash_password, verify_password
from ..db import get_session
from ..models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    email: str


class TokenOut(BaseModel):
    token: str
    user: UserOut


def _out(u: User) -> UserOut:
    return UserOut(id=u.id, name=u.name, email=u.email)


@router.post("/register", response_model=UserOut, status_code=201)
def register(body: RegisterIn, session: Session = Depends(get_session)):
    email = body.email.lower()
    if session.exec(select(User).where(User.email == email)).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "email_taken")
    user = User(name=body.name.strip(), email=email, password_hash=hash_password(body.password))
    session.add(user)
    session.commit()
    session.refresh(user)
    return _out(user)


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == body.email.lower())).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid_credentials")
    return TokenOut(token=create_token(user.id), user=_out(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return _out(user)
