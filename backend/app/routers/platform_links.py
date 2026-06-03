import threading
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import create_api_token, get_current_user, require_admin
from app.database import get_db
from app.models import PlatformLink, User
from app.schemas import (
    AdminPlatformLinkOut,
    MyLinksOut,
    PlatformLinkCreate,
    PlatformLinkOut,
    PlatformTokenRequest,
    PlatformTokenResponse,
)

router = APIRouter(tags=["platform-links"])

# ── In-memory rate limiter (per platform_chat_id) ─────────────────────────────

_rate_store: dict[str, list[datetime]] = defaultdict(list)
_rate_lock = threading.Lock()


def _is_rate_limited(key: str, max_requests: int = 10, window_seconds: int = 60) -> bool:
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(seconds=window_seconds)
    with _rate_lock:
        _rate_store[key] = [t for t in _rate_store[key] if t > cutoff]
        if len(_rate_store[key]) >= max_requests:
            return True
        _rate_store[key].append(now)
        return False


# ── Auth-scoped endpoints ──────────────────────────────────────────────────────

@router.post("/auth/link-platform", response_model=PlatformLinkOut)
def link_platform(
    body: PlatformLinkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check if this chat_id is already linked to a DIFFERENT user
    existing_other = db.query(PlatformLink).filter(
        PlatformLink.platform == body.platform,
        PlatformLink.platform_chat_id == body.platform_chat_id,
        PlatformLink.user_id != current_user.id,
    ).first()
    if existing_other:
        raise HTTPException(
            status_code=409,
            detail="Este ID ya está vinculado a otra cuenta.",
        )

    # Upsert: replace existing link for this user+platform if any
    link = db.query(PlatformLink).filter(
        PlatformLink.user_id == current_user.id,
        PlatformLink.platform == body.platform,
    ).first()
    if link:
        link.platform_chat_id = body.platform_chat_id
        link.last_token_at = None
    else:
        link = PlatformLink(
            user_id=current_user.id,
            platform=body.platform,
            platform_chat_id=body.platform_chat_id,
        )
        db.add(link)

    db.commit()
    db.refresh(link)
    return PlatformLinkOut(
        platform=link.platform,
        platform_chat_id=link.platform_chat_id,
        linked_at=link.created_at,
    )


@router.delete("/auth/link-platform/{platform}", status_code=204)
def unlink_platform(
    platform: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if platform not in ("telegram", "whatsapp"):
        raise HTTPException(status_code=400, detail="Plataforma inválida")
    link = db.query(PlatformLink).filter(
        PlatformLink.user_id == current_user.id,
        PlatformLink.platform == platform,
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="Vínculo no encontrado")
    db.delete(link)
    db.commit()


@router.get("/auth/my-links", response_model=MyLinksOut)
def get_my_links(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    links = db.query(PlatformLink).filter(
        PlatformLink.user_id == current_user.id
    ).all()
    by_platform = {lnk.platform: lnk for lnk in links}

    def _out(lnk: PlatformLink | None) -> PlatformLinkOut | None:
        if lnk is None:
            return None
        return PlatformLinkOut(
            platform=lnk.platform,
            platform_chat_id=lnk.platform_chat_id,
            linked_at=lnk.created_at,
        )

    return MyLinksOut(
        telegram=_out(by_platform.get("telegram")),
        whatsapp=_out(by_platform.get("whatsapp")),
    )


# ── Public endpoint for Hermes ─────────────────────────────────────────────────

@router.post("/auth/platform-token", response_model=PlatformTokenResponse)
def get_platform_token(
    body: PlatformTokenRequest,
    db: Session = Depends(get_db),
):
    rate_key = f"{body.platform}:{body.platform_chat_id}"
    if _is_rate_limited(rate_key):
        raise HTTPException(
            status_code=429,
            detail="Demasiadas solicitudes. Intenta de nuevo en un minuto.",
        )

    link = db.query(PlatformLink).filter(
        PlatformLink.platform == body.platform,
        PlatformLink.platform_chat_id == body.platform_chat_id,
    ).first()
    if not link:
        raise HTTPException(
            status_code=404,
            detail=(
                "Chat no vinculado. Ve a FundTracker y vincula tu cuenta "
                "en Settings → Mensajería."
            ),
        )

    if not link.user.is_active:
        raise HTTPException(status_code=403, detail="Cuenta desactivada.")

    link.last_token_at = datetime.now(timezone.utc)
    db.commit()

    return PlatformTokenResponse(token=create_api_token(link.user))


# ── Admin endpoint ─────────────────────────────────────────────────────────────

@router.get("/admin/platform-links", response_model=list[AdminPlatformLinkOut])
def list_platform_links(
    offset: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    rows = (
        db.query(PlatformLink)
        .join(User, PlatformLink.user_id == User.id)
        .order_by(PlatformLink.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [
        AdminPlatformLinkOut(
            id=r.id,
            user_id=r.user_id,
            username=r.user.username,
            platform=r.platform,
            platform_chat_id=r.platform_chat_id,
            last_token_at=r.last_token_at,
            created_at=r.created_at,
        )
        for r in rows
    ]
