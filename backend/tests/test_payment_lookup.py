from decimal import Decimal
from types import SimpleNamespace

from xrpl.wallet import Wallet

from app.services.xrpl_provisioning import (
    find_validated_payment_hash,
    submit_issued_currency_payment,
)

# This module must not request the mock_xrpl fixture: that replacement hides
# the ledger lookup inside submit_issued_currency_payment.


def _hex_utf8(text: str) -> str:
    return text.encode("utf-8").hex()


def _payment_entry(*, tx_hash: str, memo_data: str, memo_type: str = "remittance_id") -> dict:
    return {
        "validated": True,
        "hash": tx_hash,
        "meta": {"TransactionResult": "tesSUCCESS"},
        "tx": {
            "TransactionType": "Payment",
            "hash": tx_hash,
            "Memos": [
                {
                    "Memo": {
                        "MemoData": _hex_utf8(memo_data),
                        "MemoType": _hex_utf8(memo_type),
                    }
                }
            ],
        },
    }


def _client_with_transactions(transactions: list[dict]):
    result = {"transactions": transactions}

    class _FakeClient:
        def request(self, _req):
            return SimpleNamespace(result=result)

    return _FakeClient()


def test_find_validated_payment_hash_returns_matching_memo(monkeypatch):
    correlation_id = "corr-abc-123"
    matching_hash = "MATCHING_PAYMENT_HASH"
    decoy_hash = "DECOY_PAYMENT_HASH"
    account = Wallet.create().classic_address

    monkeypatch.setattr(
        "app.services.xrpl_provisioning.get_xrpl_client",
        lambda: _client_with_transactions(
            [
                _payment_entry(tx_hash=decoy_hash, memo_data="other-correlation"),
                _payment_entry(tx_hash=matching_hash, memo_data=correlation_id),
            ]
        ),
    )

    assert find_validated_payment_hash(account, correlation_id) == matching_hash


def test_find_validated_payment_hash_returns_none_without_matching_memo(monkeypatch):
    correlation_id = "corr-missing"
    account = Wallet.create().classic_address

    monkeypatch.setattr(
        "app.services.xrpl_provisioning.get_xrpl_client",
        lambda: _client_with_transactions(
            [_payment_entry(tx_hash="DECOY_PAYMENT_HASH", memo_data="other-correlation")]
        ),
    )

    assert find_validated_payment_hash(account, correlation_id) is None


def test_submit_issued_currency_payment_returns_existing_hash_without_submit(monkeypatch):
    wallet = Wallet.create()

    monkeypatch.setattr(
        "app.services.xrpl_provisioning.find_validated_payment_hash",
        lambda account, correlation_id: "EXISTING_HASH",
    )

    def _must_not_submit(*_args, **_kwargs):
        raise AssertionError("submit_and_wait should not be called")

    monkeypatch.setattr("app.services.xrpl_provisioning.submit_and_wait", _must_not_submit)

    result = submit_issued_currency_payment(
        from_seed=wallet.seed,
        destination_address=Wallet.create().classic_address,
        amount=Decimal("1.5"),
        remittance_id="already-paid",
    )
    assert result == "EXISTING_HASH"
