from types import SimpleNamespace

import pytest

from app.models.user import User
from app.models.wallet import RecipientWallet
from app.services.recipient_wallet import ensure_xrpl_account, get_or_create_wallet_row
from tests.conftest import TestingSessionLocal


def test_ensure_xrpl_account_does_not_regenerate_after_trustset_failure(register_and_login, monkeypatch):
    """Crash after faucet-fund persist, before TrustSet: retry must reuse the
    stored address and must not call generate_and_fund_wallet again.
    """
    register_and_login()
    generate_calls = {"n": 0}

    def counting_generate():
        generate_calls["n"] += 1
        return SimpleNamespace(classic_address="rSTABLEADDRESS000000000000000000", seed="sSTABLESEED")

    def fail_trustline(_wallet):
        raise RuntimeError("TrustSet failed: tecNO_DST")

    monkeypatch.setattr("app.services.recipient_wallet.generate_and_fund_wallet", counting_generate)
    monkeypatch.setattr("app.services.recipient_wallet.establish_trustline", fail_trustline)

    db = TestingSessionLocal()
    try:
        user = db.query(User).filter(User.email == "sender@example.com").first()
        wallet = get_or_create_wallet_row(db, user.id)
        with pytest.raises(RuntimeError, match="TrustSet failed"):
            ensure_xrpl_account(db, wallet)

        assert generate_calls["n"] == 1
        db.expire_all()
        persisted = db.query(RecipientWallet).filter(RecipientWallet.user_id == user.id).first()
        assert persisted.xrpl_address == "rSTABLEADDRESS000000000000000000"
        assert persisted.secret == "sSTABLESEED"
        assert persisted.trustline_established is False

        monkeypatch.setattr(
            "app.services.recipient_wallet.establish_trustline",
            lambda w: f"FAKE_TRUSTLINE_TX_{w.classic_address}",
        )
        again = ensure_xrpl_account(db, persisted)
        assert generate_calls["n"] == 1
        assert again.xrpl_address == "rSTABLEADDRESS000000000000000000"
        assert again.trustline_established is True
    finally:
        db.close()
