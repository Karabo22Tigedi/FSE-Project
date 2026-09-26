import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.crypto import EncryptedString
from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class PlatformWallet(Base):
    """FR-27/FR-29 infrastructure: the single treasury XRPL Testnet wallet
    that holds official UCTUSD for settlement Payments.

    Hybrid custody: this one row is the platform treasury. Recipients still
    get their own Testnet accounts (see RecipientWallet) on first
    settlement. Marc funds this address with 100,000 UCTUSD after the
    TrustLine is live.

    The secret is encrypted with a key distinct from the KYC encryption
    key (NFR-04/NFR-05) and is only ever decrypted by the signing
    component - never logged, never returned via the API.
    """

    __tablename__ = "platform_wallet"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    classic_address: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    secret: Mapped[str] = mapped_column(
        EncryptedString(500, key_field="xrpl_key_encryption_key"), nullable=False
    )
    network: Mapped[str] = mapped_column(String(32), nullable=False, default="testnet")
    trustline_established: Mapped[bool] = mapped_column(default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
