import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import (
    create_api_token,
    create_session_token,
    hash_password,
    require_admin,
    verify_password,
)
from app.database import get_db
from app.models import Invitation, User
from app.schemas import (
    ApiTokenRequest,
    ApiTokenResponse,
    InviteResponse,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
)
from app.utils import provision_user_defaults

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    return TokenResponse(access_token=create_session_token(user))


@router.post("/register", response_model=TokenResponse)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    invite = (
        db.query(Invitation)
        .filter(Invitation.code == body.invite_code, Invitation.used_by.is_(None))
        .first()
    )
    if not invite:
        raise HTTPException(status_code=400, detail="Código de invitación inválido o ya usado")
    if invite.expires_at < now:
        raise HTTPException(status_code=400, detail="El código de invitación ha expirado")

    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=400, detail="El nombre de usuario ya existe")

    user = User(
        username=body.username,
        password_hash=hash_password(body.password),
        role="viewer",
        invited_by_id=invite.created_by,
    )
    db.add(user)
    db.flush()  # get user.id

    provision_user_defaults(user.id, db)

    invite.used_by = user.id
    invite.used_at = now
    db.commit()
    db.refresh(user)

    return TokenResponse(access_token=create_session_token(user))


@router.post("/invite", response_model=InviteResponse)
def create_invite(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    code = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    invite = Invitation(code=code, created_by=admin.id, expires_at=expires_at)
    db.add(invite)
    db.commit()
    return InviteResponse(
        code=code,
        invite_url=f"/register?code={code}",
        expires_at=expires_at,
    )


@router.post("/api-token", response_model=ApiTokenResponse)
def generate_api_token(
    body: ApiTokenRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == body.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="User is inactive")
    return ApiTokenResponse(token=create_api_token(user))
