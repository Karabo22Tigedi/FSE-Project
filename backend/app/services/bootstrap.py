from decimal import Decimal

from sqlalchemy.orm import Session as DBSession

from app.config import get_settings
from app.core.security import hash_password
from app.models.fee_config import FeeConfig
from app.models.limit_tier import LimitTier, LimitTierKey
from app.models.user import User, UserRole

# Mirrors the example table in the project brief (section: Remittance Limits).
DEFAULT_TIER_LIMITS = {
    LimitTierKey.UNVERIFIED: (Decimal("0"), Decimal("0")),
    LimitTierKey.VERIFIED: (Decimal("3000"), Decimal("25000")),
}


def seed_defaults(db: DBSession) -> None:
    """Seed the singleton fee config (FR-15a) and the default limit tiers
    (FR-16b) if they don't exist yet. Safe to call on every startup."""
    if db.query(FeeConfig).first() is None:
        db.add(FeeConfig())

    for tier_key, (daily, monthly) in DEFAULT_TIER_LIMITS.items():
        if db.query(LimitTier).filter(LimitTier.tier_key == tier_key).first() is None:
            db.add(LimitTier(tier_key=tier_key, daily_limit_zar=daily, monthly_limit_zar=monthly))

    db.commit()


def seed_admin_if_configured(db: DBSession) -> None:
    """Create the dashboard admin when ADMIN_EMAIL and ADMIN_PASSWORD are set.

    Public register cannot mint admins. Local demos still use scripts/create_admin.
    """
    settings = get_settings()
    email = settings.admin_email.strip()
    password = settings.admin_password
    if not email or not password:
        return
    if db.query(User).filter(User.email == email).first() is not None:
        return
    db.add(
        User(
            full_name=settings.admin_full_name,
            email=email,
            mobile_number=settings.admin_mobile_number,
            password_hash=hash_password(password),
            role=UserRole.ADMIN,
        )
    )
    db.commit()
