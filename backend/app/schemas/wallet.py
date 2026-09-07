from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class IncomingTransferOut(BaseModel):
    remittance_id: str
    rlusd_amount: Decimal
    status: str
    xrpl_tx_hash: str | None
    settled_at: datetime | None
    created_at: datetime


class CashOutSummaryOut(BaseModel):
    id: str
    rlusd_amount: Decimal
    fiat_currency: str
    fiat_payout_amount: Decimal
    status: str
    created_at: datetime
    completed_at: datetime | None
    xrpl_burn_tx_hash: str | None


class WalletOut(BaseModel):
    """FR-27/FR-28: the recipient's custodial wallet.

    `balance_rlusd` and `spendable_balance` are the same spendable ledger
    (`RecipientWallet.balance`). `on_chain_balance` is spendable plus
    cash-out amounts still reserved on-chain (requested/approved). Completing
    a cash-out burns UCTUSD by paying the issuer, so completed amounts drop
    off the chain view.
    """

    balance_rlusd: Decimal
    spendable_balance: Decimal
    on_chain_balance: Decimal
    xrpl_address: str | None
    trustline_established: bool
    incoming_transfers: list[IncomingTransferOut]
    cash_out_transactions: list[CashOutSummaryOut]
