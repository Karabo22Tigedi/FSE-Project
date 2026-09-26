from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session as DBSession

from app.core.deps import get_current_user
from app.core.money import to_decimal
from app.database import get_db
from app.models.beneficiary import Beneficiary
from app.models.cash_out import CashOutRequest, CashOutStatus
from app.models.remittance import Remittance, RemittanceStatus
from app.models.user import User
from app.schemas.wallet import CashOutSummaryOut, IncomingTransferOut, WalletOut
from app.services.recipient_wallet import get_or_create_wallet_row

router = APIRouter(prefix="/wallet", tags=["wallet"])

_VISIBLE_INCOMING_STATUSES = [
    RemittanceStatus.SETTLEMENT_QUEUED,
    RemittanceStatus.SETTLED,
    RemittanceStatus.SETTLEMENT_FAILED,
]

# Requested and approved cash-outs remain reserved on-chain after spendable
# is debited. Completing a cash-out burns UCTUSD by paying the issuer, so
# completed amounts are excluded from the chain view.
_ON_CHAIN_CASHOUT_STATUSES = (
    CashOutStatus.REQUESTED,
    CashOutStatus.APPROVED,
)


def _on_chain_balance(db: DBSession, user_id: str, spendable: Decimal) -> Decimal:
    reserved = (
        db.query(func.coalesce(func.sum(CashOutRequest.rlusd_amount), 0))
        .filter(
            CashOutRequest.user_id == user_id,
            CashOutRequest.status.in_(_ON_CHAIN_CASHOUT_STATUSES),
        )
        .scalar()
    )
    return spendable + to_decimal(reserved)


@router.get("/me", response_model=WalletOut)
def get_my_wallet(current_user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    """FR-27/FR-28: the recipient's custodial wallet - available RLUSD
    balance, incoming transfers (with status/date/XRPL tx hash), and
    cash-out history. Completing a cash-out burns UCTUSD by paying the
    issuer; on_chain_balance then excludes that reserved amount."""
    wallet_row = get_or_create_wallet_row(db, current_user.id)
    spendable = to_decimal(wallet_row.balance)

    incoming = (
        db.query(Remittance)
        .join(Beneficiary, Remittance.beneficiary_id == Beneficiary.id)
        .filter(Beneficiary.linked_user_id == current_user.id)
        .filter(Remittance.status.in_(_VISIBLE_INCOMING_STATUSES))
        .order_by(Remittance.created_at.desc())
        .all()
    )
    cash_outs = (
        db.query(CashOutRequest)
        .filter(CashOutRequest.user_id == current_user.id)
        .order_by(CashOutRequest.created_at.desc())
        .all()
    )

    return WalletOut(
        balance_rlusd=spendable,
        spendable_balance=spendable,
        on_chain_balance=_on_chain_balance(db, current_user.id, spendable),
        xrpl_address=wallet_row.xrpl_address,
        trustline_established=wallet_row.trustline_established,
        incoming_transfers=[
            IncomingTransferOut(
                remittance_id=r.id,
                rlusd_amount=r.rlusd_amount,
                status=r.status.value,
                xrpl_tx_hash=r.xrpl_settlement_tx_hash,
                settled_at=r.settled_at,
                created_at=r.created_at,
            )
            for r in incoming
        ],
        cash_out_transactions=[
            CashOutSummaryOut(
                id=c.id,
                rlusd_amount=c.rlusd_amount,
                fiat_currency=c.fiat_currency,
                fiat_payout_amount=c.fiat_payout_amount,
                status=c.status.value,
                created_at=c.created_at,
                completed_at=c.completed_at,
                xrpl_burn_tx_hash=c.xrpl_burn_tx_hash,
            )
            for c in cash_outs
        ],
    )
