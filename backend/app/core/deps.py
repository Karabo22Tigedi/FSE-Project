from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session as DBSession

from app.core.security import hash_session_token
from app.database import get_db
from app.models.kyc import KYCStatus
from app.models.session import Session as SessionModel
from app.models.user import User, UserRole

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_session(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: DBSession = Depends(get_db),
) -> SessionModel:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    token_hash = hash_session_token(credentials.credentials)
    session = db.query(SessionModel).filter(SessionModel.token_hash == token_hash).first()
    if session is None or not session.is_active():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session")

    return session


def get_current_user(
    session: SessionModel = Depends(get_current_session),
    db: DBSession = Depends(get_db),
) -> User:
    user = db.query(User).filter(User.id == session.user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator access required")
    return current_user


def require_approved_kyc(current_user: User = Depends(get_current_user)) -> User:
    """FR-09/FR-09a guard: block value leaving the platform without approved KYC.

    Wired on remittance quote creation and cash-out request (and any other
    route that Depends on this).
    """
    application = current_user.kyc_application
    if application is None or application.status != KYCStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="An approved KYC application is required for this action",
        )
    return current_user
