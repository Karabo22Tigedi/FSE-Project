from decimal import Decimal


def test_wallet_requires_auth(client):
    resp = client.get("/wallet/me")
    assert resp.status_code == 401


def test_wallet_starts_at_zero_balance(client, register_and_login):
    headers = register_and_login()
    resp = client.get("/wallet/me", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert Decimal(body["balance_rlusd"]) == Decimal("0")
    assert body["xrpl_address"] is None
    assert body["trustline_established"] is False
    assert body["incoming_transfers"] == []
    assert body["cash_out_transactions"] == []


def test_wallet_shows_settled_incoming_transfer(client, settle_a_remittance):
    """FR-27/FR-28: balance, XRPL address, and incoming transfer with
    status/date/tx hash all populated once settlement succeeds."""
    recipient_headers, _sender_headers, settled = settle_a_remittance()

    wallet = client.get("/wallet/me", headers=recipient_headers).json()
    assert Decimal(wallet["balance_rlusd"]) == Decimal(settled["rlusd_amount"])
    assert wallet["xrpl_address"] is not None
    assert wallet["trustline_established"] is True

    assert len(wallet["incoming_transfers"]) == 1
    transfer = wallet["incoming_transfers"][0]
    assert transfer["remittance_id"] == settled["id"]
    assert transfer["status"] == "settled"
    assert transfer["xrpl_tx_hash"] == settled["xrpl_settlement_tx_hash"]


def test_wallet_hides_other_recipients_transfers(client, settle_a_remittance, register_and_login):
    recipient_headers, _sender_headers, _settled = settle_a_remittance()
    other_headers = register_and_login(email="other@example.com", mobile="+27000000999")

    other_wallet = client.get("/wallet/me", headers=other_headers).json()
    assert other_wallet["incoming_transfers"] == []
    assert Decimal(other_wallet["balance_rlusd"]) == Decimal("0")


def test_wallet_exposes_spendable_and_on_chain_after_cash_out(client, settle_a_remittance, admin_headers, monkeypatch):
    recipient_headers, _sender_headers, settled = settle_a_remittance()
    client.post(
        "/kyc",
        json={
            "full_name": "Recipient",
            "date_of_birth": "1992-05-01",
            "nationality": "South African",
            "identification_number": "9205015009087",
            "residential_address": "5 Beach Road, Cape Town",
            "mobile_number": "+27000000777",
            "email_address": "recipient@example.com",
            "source_of_funds": "Employment",
        },
        headers=recipient_headers,
    )
    application_id = client.get("/kyc/me", headers=recipient_headers).json()["id"]
    client.post(f"/kyc/{application_id}/approve", headers=admin_headers)

    before = client.get("/wallet/me", headers=recipient_headers).json()
    settled_amount = Decimal(settled["rlusd_amount"])
    assert Decimal(before["balance_rlusd"]) == settled_amount
    assert Decimal(before["spendable_balance"]) == settled_amount
    assert Decimal(before["on_chain_balance"]) == settled_amount

    cash_out_amount = Decimal("10.000000")
    resp = client.post(
        "/cash-outs",
        json={"rlusd_amount": str(cash_out_amount), "fiat_currency": "USD"},
        headers=recipient_headers,
    )
    assert resp.status_code == 201

    after = client.get("/wallet/me", headers=recipient_headers).json()
    assert Decimal(after["spendable_balance"]) == settled_amount - cash_out_amount
    assert Decimal(after["balance_rlusd"]) == Decimal(after["spendable_balance"])
    assert Decimal(after["on_chain_balance"]) == settled_amount
    assert Decimal(after["on_chain_balance"]) > Decimal(after["spendable_balance"])

    cash_out_id = resp.json()["id"]
    monkeypatch.setattr(
        "app.api.routes.cash_out.submit_issued_currency_payment",
        lambda *args, **kwargs: "FAKE_BURN_TX",
    )
    assert client.post(f"/cash-outs/{cash_out_id}/approve", headers=admin_headers).status_code == 200
    complete = client.post(f"/cash-outs/{cash_out_id}/complete", headers=admin_headers)
    assert complete.status_code == 200

    burned = client.get("/wallet/me", headers=recipient_headers).json()
    assert Decimal(burned["on_chain_balance"]) == Decimal(burned["spendable_balance"])
    assert Decimal(burned["spendable_balance"]) == Decimal(after["spendable_balance"])
    assert burned["cash_out_transactions"][0]["xrpl_burn_tx_hash"] is not None
