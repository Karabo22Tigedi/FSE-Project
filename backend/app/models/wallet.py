import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.crypto import EncryptedString
from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class RecipientWallet(Base):
    """FR-27: a recipient's custodial wallet.

    The internal ledger row (this record) is created immediately once a
    beneficiary links to the user (FR-12b), with balance=0 and no XRPL
    account yet - fast, no network calls, so registration/beneficiary
    endpoints stay network-free. The actual XRPL Testnet account (address
    + encrypted secret) is generated lazily on first real settlement (see
    app.services.recipient_wallet.ensure_xrpl_account): funded via the
    free/unlimited faucet and given a TrustLine to the issuer (FR-29).

    `balance` is the **spendable** internal ledger. The settlement worker
    credits it (`recipient_wallet_row.balance += remittance.rlusd_amount`)
    and cash-out atomically debits it. It is not a live XRPL balance:
    requested/approved/completed cash-outs still represent tokens that
    remain on-chain (simulated cash-out does not burn). GET /wallet/me
    reports on_chain_balance as spendable plus those outstanding amounts.
    """

    __tablename__ = "recipient_wallets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), unique=True, nullable=False)
    xrpl_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    secret: Mapped[str | None] = mapped_column(
        EncryptedString(500, key_field="xrpl_key_encryption_key"), nullable=True
    )
    trustline_established: Mapped[bool] = mapped_column(default=False, nullable=False)
    balance: Mapped[Decimal] = mapped_column(Numeric(14, 6), default=Decimal("0"), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    user: Mapped["User"] = relationship("User")
