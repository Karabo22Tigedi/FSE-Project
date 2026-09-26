import enum
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class RemittanceStatus(str, enum.Enum):
    QUOTED = "quoted"
    CANCELLED = "cancelled"
    CASH_IN_PENDING = "cash_in_pending"
    CASH_IN_CONFIRMED = "cash_in_confirmed"
    SETTLEMENT_QUEUED = "settlement_queued"
    SETTLED = "settled"
    SETTLEMENT_FAILED = "settlement_failed"


class CashInMethod(str, enum.Enum):
    """FR-18: one supported simulated ZAR payment method per remittance."""

    AGENT_CASH = "agent_cash"
    BANK_TRANSFER = "bank_transfer"
    CARD = "card"


def _uuid() -> str:
    return str(uuid.uuid4())


def _tracking_ref() -> str:
    """Human-readable unique ref: MG + 10 decimal digits (not a UUID)."""
    return f"MG{secrets.randbelow(10**10):010d}"


def _default_expires_at() -> datetime:
    from app.config import get_settings

    return datetime.now(timezone.utc) + timedelta(seconds=get_settings().quote_ttl_seconds)


class Remittance(Base):
    """FR-13/FR-14: a remittance transaction, created at quote time with
    the exchange rate and fee breakdown locked in.

    FR-16/FR-17: daily/monthly limits count a quote only while it is still
    live: status is not cancelled, and if status is quoted it has not
    expired. Cash-in onward (including settlement_failed) always counts.
    See app.services.limits.

    Quotes expire after QUOTE_TTL_SECONDS (default 15 minutes). The sender
    may cancel a still-valid quoted remittance. Expired or cancelled quotes
    cannot be cashed in.

    FR-18/FR-19/FR-20: the sender initiates a simulated cash-in (locking in
    a method and moving to CASH_IN_PENDING), and an admin confirms receipt
    (moving to CASH_IN_CONFIRMED, which immediately enqueues settlement -
    see app.services.settlement.enqueue_settlement - satisfying FR-20's
    "no settlement before cash-in is confirmed").

    FR-22/FR-23: the settlement worker moves this to SETTLED (with
    xrpl_settlement_tx_hash set) on success, or SETTLEMENT_FAILED (with
    settlement_failure_reason set) on failure - see app.services.settlement.
    """

    __tablename__ = "remittances"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    tracking_ref: Mapped[str] = mapped_column(
        String(12), unique=True, index=True, nullable=False, default=_tracking_ref
    )
    sender_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    beneficiary_id: Mapped[str] = mapped_column(String(36), ForeignKey("beneficiaries.id"), nullable=False)

    zar_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    exchange_rate: Mapped[Decimal] = mapped_column(Numeric(14, 6), nullable=False)
    fx_margin_percentage: Mapped[Decimal] = mapped_column(Numeric(6, 4), nullable=False)
    transaction_fee_zar: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    rlusd_amount: Mapped[Decimal] = mapped_column(Numeric(14, 6), nullable=False)
    cash_out_fee_percentage: Mapped[Decimal] = mapped_column(Numeric(6, 4), nullable=False)
    estimated_cash_out_fee: Mapped[Decimal] = mapped_column(Numeric(14, 6), nullable=False)
    estimated_recipient_payout: Mapped[Decimal] = mapped_column(Numeric(14, 6), nullable=False)

    status: Mapped[RemittanceStatus] = mapped_column(
        Enum(RemittanceStatus), default=RemittanceStatus.QUOTED, nullable=False
    )

    cash_in_method: Mapped[CashInMethod | None] = mapped_column(Enum(CashInMethod), nullable=True)
    cash_in_initiated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cash_in_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cash_in_confirmed_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)

    xrpl_settlement_tx_hash: Mapped[str | None] = mapped_column(String(96), nullable=True)
    settled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    settlement_failure_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_default_expires_at, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    sender: Mapped["User"] = relationship("User", foreign_keys=[sender_id])
    beneficiary: Mapped["Beneficiary"] = relationship("Beneficiary")

    def is_expired(self) -> bool:
        expires_at = self.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) >= expires_at
