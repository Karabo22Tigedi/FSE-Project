from decimal import Decimal

import pytest


@pytest.fixture(autouse=True)
def _never_hit_testnet(monkeypatch):
    monkeypatch.setattr("app.api.routes.platform_wallet.get_xrp_balance", lambda wallet_row: "1000000")
    monkeypatch.setattr(
        "app.api.routes.platform_wallet.get_issued_currency_balance",
        lambda address: Decimal("100000"),
    )

    def fake_establish_trustline(db, wallet_row):
        wallet_row.trustline_established = True
        db.add(wallet_row)
        db.commit()
        db.refresh(wallet_row)
        return "FAKE_TRUSTLINE_TX"

    monkeypatch.setattr("app.api.routes.platform_wallet.establish_trustline", fake_establish_trustline)


def test_unauthenticated_cannot_view_platform_wallet(client):
    resp = client.get("/admin/platform-wallet")
    assert resp.status_code == 401


def test_non_admin_cannot_view_platform_wallet(client, register_and_login):
    headers = register_and_login()
    resp = client.get("/admin/platform-wallet", headers=headers)
    assert resp.status_code == 403


def test_admin_gets_404_when_platform_wallet_missing(client, admin_headers):
    resp = client.get("/admin/platform-wallet", headers=admin_headers)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Platform wallet is not set up. Run python -m scripts.setup_platform_wallet"


def test_admin_can_view_platform_wallet(client, admin_headers, platform_wallet_row):
    resp = client.get("/admin/platform-wallet", headers=admin_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["classic_address"] == platform_wallet_row.classic_address
    assert "secret" not in body
    assert "seed" not in body
    assert "sFAKEPLATFORMSECRET" not in resp.text
    assert body["trustline_established"] is True
    assert body["xrp_drops"] == "1000000"
    assert body["uctusd_balance"] == "100000"
    assert body["liquidity_ready"] is True
    assert body["explorer_url"] == (
        "https://testnet.xrpl.org/token/5543545553440000000000000000000000000000.rELez4x4Zqv3KYqboYVfrYPF8521Ycbxa5"
    )


def test_balance_failures_still_return_address(client, admin_headers, platform_wallet_row, monkeypatch):
    def boom_xrp(_wallet_row):
        raise RuntimeError("xrp lookup failed")

    def boom_iou(_address):
        raise RuntimeError("iou lookup failed")

    monkeypatch.setattr("app.api.routes.platform_wallet.get_xrp_balance", boom_xrp)
    monkeypatch.setattr("app.api.routes.platform_wallet.get_issued_currency_balance", boom_iou)

    resp = client.get("/admin/platform-wallet", headers=admin_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["classic_address"] == platform_wallet_row.classic_address
    assert body["xrp_drops"] == "0"
    assert body["uctusd_balance"] == "0"
    assert body["liquidity_ready"] is False
    assert "secret" not in body


def test_independent_balance_failure_does_not_hide_other(client, admin_headers, platform_wallet_row, monkeypatch):
    def boom_xrp(_wallet_row):
        raise RuntimeError("xrp lookup failed")

    monkeypatch.setattr("app.api.routes.platform_wallet.get_xrp_balance", boom_xrp)

    resp = client.get("/admin/platform-wallet", headers=admin_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["classic_address"] == platform_wallet_row.classic_address
    assert body["xrp_drops"] == "0"
    assert body["uctusd_balance"] == "100000"
    assert body["liquidity_ready"] is True


def test_unauthenticated_cannot_establish_trustline(client):
    resp = client.post("/admin/platform-wallet/trustline")
    assert resp.status_code == 401


def test_non_admin_cannot_establish_trustline(client, register_and_login):
    headers = register_and_login()
    resp = client.post("/admin/platform-wallet/trustline", headers=headers)
    assert resp.status_code == 403


def test_establish_trustline_404_when_missing(client, admin_headers):
    resp = client.post("/admin/platform-wallet/trustline", headers=admin_headers)
    assert resp.status_code == 404


def test_establish_trustline_when_already_established(client, admin_headers, platform_wallet_row, monkeypatch):
    def fail_if_called(_db, _wallet_row):
        raise AssertionError("establish_trustline should not run when already established")

    monkeypatch.setattr("app.api.routes.platform_wallet.establish_trustline", fail_if_called)

    resp = client.post("/admin/platform-wallet/trustline", headers=admin_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["classic_address"] == platform_wallet_row.classic_address
    assert body["trustline_established"] is True
    assert "secret" not in body
