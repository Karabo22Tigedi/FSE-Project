from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session as DBSession

from app.config import get_settings
from app.core.deps import require_admin
from app.database import get_db
from app.models.platform_wallet import PlatformWallet
from app.models.user import User
from app.schemas.platform_wallet import PlatformWalletOut
from app.services.platform_wallet import establish_trustline, get_platform_wallet_row, get_xrp_balance
from app.services.xrpl_provisioning import get_issued_currency_balance

router = APIRouter(prefix="/admin", tags=["admin"])

_NOT_SETUP_DETAIL = "Platform wallet is not set up. Run python -m scripts.setup_platform_wallet"
_EXPLORER_URL = (
    "https://testnet.xrpl.org/token/5543545553440000000000000000000000000000.rELez4x4Zqv3KYqboYVfrYPF8521Ycbxa5"
)


def _require_platform_wallet(db: DBSession) -> PlatformWallet:
    wallet_row = get_platform_wallet_row(db)
    if wallet_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_SETUP_DETAIL)
    return wallet_row


def _status_payload(wallet_row: PlatformWallet) -> PlatformWalletOut:
    settings = get_settings()

    xrp_drops = "0"
    try:
        xrp_drops = str(get_xrp_balance(wallet_row))
    except Exception:
        xrp_drops = "0"

    uctusd_balance = "0"
    try:
        uctusd_balance = str(get_issued_currency_balance(wallet_row.classic_address))
    except Exception:
        uctusd_balance = "0"

    try:
        liquidity_ready = wallet_row.trustline_established and Decimal(uctusd_balance) > 0
    except (InvalidOperation, ValueError):
        liquidity_ready = False

    return PlatformWalletOut(
        classic_address=wallet_row.classic_address,
        network=wallet_row.network,
        trustline_established=wallet_row.trustline_established,
        xrp_drops=xrp_drops,
        uctusd_balance=uctusd_balance,
        issuer_address=settings.xrpl_issuer_address,
        currency_code=settings.xrpl_currency_code,
        currency_symbol=settings.xrpl_currency_symbol,
        distributor_address=settings.xrpl_distributor_address,
        explorer_url=_EXPLORER_URL,
        liquidity_ready=liquidity_ready,
    )


@router.get("/platform-wallet", response_model=PlatformWalletOut)
def get_platform_wallet(_admin: User = Depends(require_admin), db: DBSession = Depends(get_db)):
    """Admin view of the single treasury XRPL account. Never returns the seed."""
    return _status_payload(_require_platform_wallet(db))


@router.post("/platform-wallet/trustline", response_model=PlatformWalletOut)
def establish_platform_trustline(_admin: User = Depends(require_admin), db: DBSession = Depends(get_db)):
    """Establish the UCTUSD TrustLine if it is not already set. Does not create a wallet."""
    wallet_row = _require_platform_wallet(db)
    if not wallet_row.trustline_established:
        establish_trustline(db, wallet_row)
    return _status_payload(wallet_row)
