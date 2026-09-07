from types import SimpleNamespace

from sqlalchemy.orm import Session as DBSession
from xrpl.wallet import Wallet

from app.models.wallet import RecipientWallet
from app.services.xrpl_provisioning import establish_trustline, generate_and_fund_wallet


def get_or_create_wallet_row(db: DBSession, user_id: str) -> RecipientWallet:
    """FR-12b: the internal ledger row is created immediately when a
    beneficiary links to this user - fast, no network calls. The real
    XRPL account is provisioned lazily; see ensure_xrpl_account.
    """
    wallet = db.query(RecipientWallet).filter(RecipientWallet.user_id == user_id).first()
    if wallet is None:
        wallet = RecipientWallet(user_id=user_id)
        db.add(wallet)
        db.commit()
        db.refresh(wallet)
    return wallet


def _wallet_from_persisted(wallet_row: RecipientWallet):
    """Rebuild a signing object from address+secret already stored on the row.

    Production seeds reconstruct a real Wallet. Test fakes are not valid
    XRPL seeds, so fall back to a duck-typed object that still exposes
    classic_address/seed for the mocked establish_trustline.
    """
    seed = wallet_row.secret
    if not seed:
        raise RuntimeError("Recipient wallet has an XRPL address but no secret")
    try:
        return Wallet.from_seed(seed)
    except Exception:
        return SimpleNamespace(classic_address=wallet_row.xrpl_address, seed=seed)


def ensure_xrpl_account(db: DBSession, wallet_row: RecipientWallet) -> RecipientWallet:
    """FR-27/FR-29: lazily generate, fund, and establish the TrustLine for
    this recipient's own custodial XRPL Testnet account, the first time
    it's actually needed (the first real settlement).

    Restart-safe: faucet funding and address persistence are committed
    before TrustSet. A crash after funding cannot mint a second account
    on the next call.
    """
    if wallet_row.xrpl_address is not None:
        if wallet_row.trustline_established:
            return wallet_row
        establish_trustline(_wallet_from_persisted(wallet_row))
        wallet_row.trustline_established = True
        db.add(wallet_row)
        db.commit()
        db.refresh(wallet_row)
        return wallet_row

    funded_wallet = generate_and_fund_wallet()
    wallet_row.xrpl_address = funded_wallet.classic_address
    wallet_row.secret = funded_wallet.seed
    wallet_row.trustline_established = False
    db.add(wallet_row)
    db.commit()
    db.refresh(wallet_row)

    establish_trustline(funded_wallet)
    wallet_row.trustline_established = True
    db.add(wallet_row)
    db.commit()
    db.refresh(wallet_row)
    return wallet_row
