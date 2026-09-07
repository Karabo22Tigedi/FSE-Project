"""Generate (or reuse) the platform's XRPL Testnet wallet and establish its
TrustLine to the configured issuer (UCTUSD by default, see .env.example).

Run once per environment:

    python -m scripts.setup_platform_wallet

Prints the wallet's public classic address so it can be emailed to Marc
for the 100,000 UCTUSD grant from the distributor. Do not generate your
own token. The private key/seed is encrypted at rest and is never
printed (NFR-05).
"""

import sys

sys.path.insert(0, ".")

from app.config import get_settings  # noqa: E402
from app.database import Base, SessionLocal, engine  # noqa: E402
from app.services.platform_wallet import (  # noqa: E402
    establish_trustline,
    get_or_create_platform_wallet,
    get_uctusd_balance,
    get_xrp_balance,
)


def main():
    Base.metadata.create_all(bind=engine)
    settings = get_settings()
    db = SessionLocal()
    try:
        print(f"Network: {settings.xrpl_json_rpc_url}")
        print(f"Issuer:  {settings.xrpl_issuer_address}")
        print(f"Currency: {settings.xrpl_currency_code}")
        print()

        wallet_row = get_or_create_platform_wallet(db)
        print(f"Platform wallet address: {wallet_row.classic_address}")
        print(f"Currency symbol: {settings.xrpl_currency_symbol}")
        print(f"Distributor address: {settings.xrpl_distributor_address}")
        print(f"XRP balance: {get_xrp_balance(wallet_row)} drops-worth of XRP")
        try:
            iou_balance = get_uctusd_balance(wallet_row)
            print(f"{settings.xrpl_currency_symbol} IOU balance: {iou_balance}")
        except Exception as exc:
            print(f"Could not fetch {settings.xrpl_currency_symbol} IOU balance ({exc}).")

        if wallet_row.trustline_established:
            print("TrustLine to the issuer is already established.")
        else:
            print("Submitting TrustSet to the issuer...")
            tx_hash = establish_trustline(db, wallet_row)
            print(f"TrustLine established. Transaction hash: {tx_hash}")

        print()
        print(
            "Email this classic address to Marc so he can fund 100,000 UCTUSD "
            f"from the distributor ({settings.xrpl_distributor_address}). "
            "Do not generate your own token."
        )
        print(f"  {wallet_row.classic_address}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
