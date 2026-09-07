import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from passlib.context import CryptContext
from sqlalchemy.orm import Session as DBSession

from app.config import get_settings
from app.models.session import Session as SessionModel

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def hash_session_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def create_session(db: DBSession, user_id: str) -> tuple[SessionModel, str]:
    """Create a session row storing only SHA-256(token). Returns (row, raw token)."""
    settings = get_settings()
    raw_token = secrets.token_urlsafe(48)
    session = SessionModel(
        user_id=user_id,
        token_hash=hash_session_token(raw_token),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=settings.session_expire_hours),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session, raw_token


def revoke_session(db: DBSession, session: SessionModel) -> None:
    session.revoked_at = datetime.now(timezone.utc)
    db.add(session)
    db.commit()
