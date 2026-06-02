from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User

ALGORITHM = "HS256"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_session_token(user: User) -> str:
    """Session token: 1-year expiry, includes read_only_mode."""
    payload = {
        "sub": user.username,
        "role": user.role,
        "read_only": user.read_only_mode,
        "token_type": "session",
        "exp": datetime.now(timezone.utc) + timedelta(days=365),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def create_api_token(user: User) -> str:
    """API token: no expiry, for Hermes / programmatic access."""
    payload = {
        "sub": user.username,
        "role": user.role,
        "token_type": "api",
        # No 'exp' field → never expires
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def _get_current_user(token: str, db: Session) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # API tokens have no 'exp' — disable expiry verification for them
        options = {"verify_exp": True}
        try:
            payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM], options=options)
        except JWTError as e:
            # If the error is about expiry, re-raise. Otherwise check if it's a no-exp token.
            if "expired" in str(e).lower():
                raise credentials_exc
            # Try decoding without exp verification (for API tokens)
            payload = jwt.decode(
                token, settings.secret_key, algorithms=[ALGORITHM],
                options={"verify_exp": False}
            )
            # Only allow tokens that explicitly have no exp (API tokens)
            if "exp" in payload:
                raise credentials_exc

        username: str | None = payload.get("sub")
        if username is None:
            raise credentials_exc
    except JWTError:
        raise credentials_exc

    user = db.query(User).filter(User.username == username).first()
    if user is None or not user.is_active:
        raise credentials_exc
    return user


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    return _get_current_user(token, db)


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def require_write_access(user: User = Depends(get_current_user)) -> User:
    """Blocks writes when the user has read_only_mode enabled."""
    if user.read_only_mode:
        raise HTTPException(
            status_code=403,
            detail="Modo lectura activado. Desactívalo para realizar cambios.",
        )
    return user
