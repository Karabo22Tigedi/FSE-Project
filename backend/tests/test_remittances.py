import re
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.models.remittance import Remittance


def _db():
    from tests.conftest import TestingSessionLocal

    return TestingSessionLocal()


def _age_quote(remittance_id: str) -> None:
    db = _db()
    try:
        row = db.query(Remittance).filter(Remittance.id == remittance_id).first()
        row.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.add(row)
        db.commit()
    finally:
        db.close()


def _add_beneficiary(client, headers, email="ben@example.com"):
    resp = client.post(
        "/beneficiaries",
        json={
            "full_name": "Ben Recipient",
            "email_address": email,
            "country": "South Africa",
            "payout_currency": "USD",
            "relationship_to_sender": "Friend",
        },
        headers=headers,
    )
    return resp.json()["id"]


def test_create_quote_requires_approved_kyc(client, register_and_login):
    headers = register_and_login()
    resp = client.post("/remittances", json={"beneficiary_id": "whatever", "zar_amount": "100.00"}, headers=headers)
    assert resp.status_code == 403


def test_create_quote_for_nonexistent_beneficiary(client, approved_sender):
    headers = approved_sender()
    resp = client.post(
        "/remittances", json={"beneficiary_id": "does-not-exist", "zar_amount": "100.00"}, headers=headers
    )
    assert resp.status_code == 404


def test_create_quote_rejects_other_senders_beneficiary(client, approved_sender):
    headers_a = approved_sender(email="a@example.com", mobile="+27000000001")
    headers_b = approved_sender(email="b@example.com", mobile="+27000000002")
    beneficiary_id = _add_beneficiary(client, headers_a)

    resp = client.post(
        "/remittances", json={"beneficiary_id": beneficiary_id, "zar_amount": "100.00"}, headers=headers_b
    )
    assert resp.status_code == 404


def test_create_quote_returns_full_fee_breakdown(client, approved_sender):
    """FR-14: default fee config is fixed=25.00 ZAR, pct=1%, fx_margin=2%,
    cash_out_fee=1.5%. Default USD/ZAR rate is 18.50. Verify the maths for
    a known ZAR 1000 send."""
    headers = approved_sender()
    beneficiary_id = _add_beneficiary(client, headers)

    resp = client.post(
        "/remittances", json={"beneficiary_id": beneficiary_id, "zar_amount": "1000.00"}, headers=headers
    )
    assert resp.status_code == 201
    body = resp.json()

    assert body["status"] == "quoted"
    assert Decimal(body["transaction_fee_zar"]) == Decimal("35.00")  # 25 + 1% of 1000
    assert Decimal(body["exchange_rate"]) == Decimal("18.870000")  # 18.50 * 1.02
    expected_rlusd = (Decimal("1000.00") - Decimal("35.00")) / Decimal("18.870000")
    assert Decimal(body["rlusd_amount"]) == expected_rlusd.quantize(Decimal("0.000001"))
    assert Decimal(body["fx_margin_percentage"]) == Decimal("0.0200")
    assert Decimal(body["cash_out_fee_percentage"]) == Decimal("0.0150")


def test_create_quote_rejected_over_daily_limit(client, approved_sender):
    """FR-16/FR-17: default verified tier is ZAR 3000 daily / 25000 monthly."""
    headers = approved_sender()
    beneficiary_id = _add_beneficiary(client, headers)

    first = client.post(
        "/remittances", json={"beneficiary_id": beneficiary_id, "zar_amount": "2500.00"}, headers=headers
    )
    assert first.status_code == 201

    second = client.post(
        "/remittances", json={"beneficiary_id": beneficiary_id, "zar_amount": "600.00"}, headers=headers
    )
    assert second.status_code == 422
    assert "daily limit" in second.json()["detail"]


def test_create_quote_rejected_over_monthly_limit(client, approved_sender, admin_headers):
    """Raise the daily cap via the admin endpoint so the monthly cap is the
    one being exercised in isolation (FR-16b feeding into FR-17)."""
    headers = approved_sender()
    beneficiary_id = _add_beneficiary(client, headers)

    client.put("/admin/limit-tiers/verified", json={"daily_limit_zar": "100000"}, headers=admin_headers)

    first = client.post(
        "/remittances", json={"beneficiary_id": beneficiary_id, "zar_amount": "24000.00"}, headers=headers
    )
    assert first.status_code == 201

    second = client.post(
        "/remittances", json={"beneficiary_id": beneficiary_id, "zar_amount": "2000.00"}, headers=headers
    )
    assert second.status_code == 422
    assert "monthly limit" in second.json()["detail"]


def test_create_quote_sets_tracking_ref_and_expires_at(client, approved_sender):
    headers = approved_sender()
    beneficiary_id = _add_beneficiary(client, headers)

    resp = client.post(
        "/remittances", json={"beneficiary_id": beneficiary_id, "zar_amount": "100.00"}, headers=headers
    )
    assert resp.status_code == 201
    body = resp.json()
    assert re.fullmatch(r"MG\d{10}", body["tracking_ref"])
    assert re.search(r"(Z|[+-]\d{2}:\d{2})$", body["expires_at"])
    assert re.search(r"(Z|[+-]\d{2}:\d{2})$", body["created_at"])
    expires_at = datetime.fromisoformat(body["expires_at"].replace("Z", "+00:00"))
    created_at = datetime.fromisoformat(body["created_at"].replace("Z", "+00:00"))
    ttl = expires_at - created_at
    assert timedelta(seconds=890) <= ttl <= timedelta(seconds=910)


def test_cancel_quote_sender_only_from_quoted(client, approved_sender):
    headers = approved_sender()
    other = approved_sender(email="other@example.com", mobile="+27000000002")
    beneficiary_id = _add_beneficiary(client, headers)
    remittance_id = client.post(
        "/remittances", json={"beneficiary_id": beneficiary_id, "zar_amount": "100.00"}, headers=headers
    ).json()["id"]

    assert client.post(f"/remittances/{remittance_id}/cancel", headers=other).status_code == 404

    resp = client.post(f"/remittances/{remittance_id}/cancel", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"

    again = client.post(f"/remittances/{remittance_id}/cancel", headers=headers)
    assert again.status_code == 409


def test_cannot_cancel_expired_quote(client, approved_sender):
    headers = approved_sender()
    beneficiary_id = _add_beneficiary(client, headers)
    remittance_id = client.post(
        "/remittances", json={"beneficiary_id": beneficiary_id, "zar_amount": "100.00"}, headers=headers
    ).json()["id"]
    _age_quote(remittance_id)

    resp = client.post(f"/remittances/{remittance_id}/cancel", headers=headers)
    assert resp.status_code == 409


def test_cancel_frees_daily_limit(client, approved_sender):
    headers = approved_sender()
    beneficiary_id = _add_beneficiary(client, headers)

    first = client.post(
        "/remittances", json={"beneficiary_id": beneficiary_id, "zar_amount": "2500.00"}, headers=headers
    )
    assert first.status_code == 201
    assert client.post(f"/remittances/{first.json()['id']}/cancel", headers=headers).status_code == 200

    second = client.post(
        "/remittances", json={"beneficiary_id": beneficiary_id, "zar_amount": "2500.00"}, headers=headers
    )
    assert second.status_code == 201


def test_expired_quote_does_not_consume_daily_limit(client, approved_sender):
    headers = approved_sender()
    beneficiary_id = _add_beneficiary(client, headers)

    first = client.post(
        "/remittances", json={"beneficiary_id": beneficiary_id, "zar_amount": "2500.00"}, headers=headers
    )
    assert first.status_code == 201
    _age_quote(first.json()["id"])

    second = client.post(
        "/remittances", json={"beneficiary_id": beneficiary_id, "zar_amount": "2500.00"}, headers=headers
    )
    assert second.status_code == 201


def test_cannot_cash_in_expired_or_cancelled_quote(client, approved_sender):
    headers = approved_sender()
    beneficiary_id = _add_beneficiary(client, headers)

    expired_id = client.post(
        "/remittances", json={"beneficiary_id": beneficiary_id, "zar_amount": "100.00"}, headers=headers
    ).json()["id"]
    _age_quote(expired_id)
    expired = client.post(
        f"/remittances/{expired_id}/cash-in", json={"method": "bank_transfer"}, headers=headers
    )
    assert expired.status_code == 409
    assert "expired" in expired.json()["detail"].lower()

    cancelled_id = client.post(
        "/remittances", json={"beneficiary_id": beneficiary_id, "zar_amount": "100.00"}, headers=headers
    ).json()["id"]
    client.post(f"/remittances/{cancelled_id}/cancel", headers=headers)
    cancelled = client.post(
        f"/remittances/{cancelled_id}/cash-in", json={"method": "bank_transfer"}, headers=headers
    )
    assert cancelled.status_code == 409
    assert "cancelled" in cancelled.json()["detail"].lower()


def test_fee_larger_than_send_amount_rejected(client, approved_sender, admin_headers):
    headers = approved_sender()
    beneficiary_id = _add_beneficiary(client, headers)
    client.put("/admin/fee-config", json={"fixed_fee_zar": "1000.00"}, headers=admin_headers)

    resp = client.post(
        "/remittances", json={"beneficiary_id": beneficiary_id, "zar_amount": "100.00"}, headers=headers
    )
    assert resp.status_code == 422
    assert "fee" in resp.json()["detail"].lower()


def test_track_remittance_by_ref(client, approved_sender, register_and_login):
    headers = approved_sender()
    stranger = register_and_login(email="stranger@example.com", mobile="+27000000991")
    beneficiary_id = _add_beneficiary(client, headers)
    body = client.post(
        "/remittances", json={"beneficiary_id": beneficiary_id, "zar_amount": "100.00"}, headers=headers
    ).json()

    tracked = client.get(f"/remittances/track/{body['tracking_ref']}", headers=headers)
    assert tracked.status_code == 200
    assert tracked.json()["id"] == body["id"]

    forbidden = client.get(f"/remittances/track/{body['tracking_ref']}", headers=stranger)
    assert forbidden.status_code == 403

    missing = client.get("/remittances/track/MG0000000000", headers=headers)
    assert missing.status_code == 404
