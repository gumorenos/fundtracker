from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user, hash_password, require_admin, verify_password
from app.database import get_db
from app.models import User
from app.schemas import (
    PasswordChangeRequest,
    ReadOnlyModeUpdate,
    UserActiveUpdate,
    UserListOut,
    UserMeOut,
)

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserMeOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me/read-only-mode", response_model=UserMeOut)
def set_read_only_mode(
    body: ReadOnlyModeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.read_only_mode = body.enabled
    db.commit()
    db.refresh(current_user)
    return current_user


@router.put("/me/password")
def change_password(
    body: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Contraseña actual incorrecta")
    current_user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"detail": "Contraseña actualizada"}


@router.get("", response_model=list[UserListOut])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return db.query(User).order_by(User.created_at).all()


@router.put("/{user_id}/active", response_model=UserListOut)
def set_user_active(
    user_id: int,
    body: UserActiveUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="No puedes desactivar tu propia cuenta")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = body.is_active
    db.commit()
    db.refresh(user)
    return user
