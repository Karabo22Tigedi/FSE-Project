from decimal import Decimal


def _linked_beneficiary_and_quote(client, sender_headers, recipient_email, recipient_mobile, zar_amount="1000.00"):
    client.post(
        "/auth/register",
        json={
            "full_name": "Recipient",
            "email": recipient_email,
            "mobile_number": recipient_mobile,
            "password": "RecipientPass123",
        },
    )
    ben_resp = client.post(
        "/beneficiaries",
        json={
            "full_name": "Recipient",
            "email_address": recipient_email,
            "country": "South Africa",
            "payout_currency": "USD",
            "relationship_to_sender": "Friend",
        },
        headers=sender_headers,
    )
    beneficiary_id = ben_resp.json()["id"]
    assert ben_resp.json()["linked_user_id"] is not None

    quote_resp = client.post(
        "/remittances", json={"beneficiary_id": beneficiary_id, "zar_amount": zar_amount}, headers=sender_headers
    )
    return quote_resp.json()["id"]


def _confirmed_remittance(client, sender_headers, admin_headers, remittance_id):
    client.post(f"/remittances/{remittance_id}/cash-in", json={"method": "bank_transfer"}, headers=sender_headers)
    return client.post(f"/remittances/{remittance_id}/confirm-cash-in", headers=admin_headers)


def test_confirm_cash_in_enqueues_settlement_message(client, approved_sender, admin_headers):
    """FR-20/FR-21: confirming cash-in queues settlement."""
    sender_headers = approved_sender()
    remittance_id = _linked_beneficiary_and_quote(client, sender_headers, "r1@example.com", "+27000000701")

    confirm_resp = _confirmed_remittance(client, sender_headers, admin_headers, remittance_id)
    assert confirm_resp.json()["status"] == "settlement_queued"

    pending = client.get("/admin/settlement?message_status=pending", headers=admin_headers).json()
    assert any(m["remittance_id"] == remittance_id for m in pending)


def test_settlement_run_succeeds_and_credits_wallet(
    client, approved_sender, admin_headers, platform_wallet_row, mock_xrpl
):
    """FR-22/FR-23/FR-26: worker submits the Payment, records the tx hash,
    and credits the recipient's wallet balance."""
    sender_headers = approved_sender()
    remittance_id = _linked_beneficiary_and_quote(client, sender_headers, "r2@example.com", "+27000000702")
    _confirmed_remittance(client, sender_headers, admin_headers, remittance_id)

    run_resp = client.post("/admin/settlement/run", headers=admin_headers)
    assert run_resp.status_code == 200
    results = run_resp.json()
    assert len(results) == 1
    assert results[0]["status"] == "completed"

    remittances = client.get("/remittances/me", headers=sender_headers).json()
    settled = next(r for r in remittances if r["id"] == remittance_id)
    assert settled["status"] == "settled"
    assert settled["xrpl_settlement_tx_hash"] is not None

    recipient_login = client.post("/auth/login", json={"email": "r2@example.com", "password": "RecipientPass123"})
    recipient_headers = {"Authorization": f"Bearer {recipient_login.json()['access_token']}"}
    wallet = client.get("/wallet/me", headers=recipient_headers).json()
    assert Decimal(wallet["balance_rlusd"]) == Decimal(settled["rlusd_amount"])


def test_settlement_failure_does_not_credit_wallet(
    client, approved_sender, admin_headers, platform_wallet_row, mock_xrpl
):
    """FR-24: a failed on-chain Payment must not credit the recipient."""
    mock_xrpl["should_fail"] = True
    sender_headers = approved_sender()
    remittance_id = _linked_beneficiary_and_quote(client, sender_headers, "r3@example.com", "+27000000703")
    _confirmed_remittance(client, sender_headers, admin_headers, remittance_id)

    run_resp = client.post("/admin/settlement/run", headers=admin_headers)
    results = run_resp.json()
    assert results[0]["status"] == "failed"
    assert "tecUNFUNDED_PAYMENT" in results[0]["failure_reason"]

    remittances = client.get("/remittances/me", headers=sender_headers).json()
    settled = next(r for r in remittances if r["id"] == remittance_id)
    assert settled["status"] == "settlement_failed"

    recipient_login = client.post("/auth/login", json={"email": "r3@example.com", "password": "RecipientPass123"})
    recipient_headers = {"Authorization": f"Bearer {recipient_login.json()['access_token']}"}
    wallet = client.get("/wallet/me", headers=recipient_headers).json()
    assert Decimal(wallet["balance_rlusd"]) == Decimal("0")


def test_settlement_without_platform_wallet_fails_gracefully(client, approved_sender, admin_headers, mock_xrpl):
    """No platform_wallet_row fixture used here - simulates the real state
    before scripts/setup_platform_wallet.py has ever been run."""
    sender_headers = approved_sender()
    remittance_id = _linked_beneficiary_and_quote(client, sender_headers, "r4@example.com", "+27000000704")
    _confirmed_remittance(client, sender_headers, admin_headers, remittance_id)

    run_resp = client.post("/admin/settlement/run", headers=admin_headers)
    results = run_resp.json()
    assert results[0]["status"] == "failed"
    assert "Platform wallet is not set up" in results[0]["failure_reason"]


def test_settlement_fails_when_platform_trustline_missing(client, approved_sender, admin_headers, mock_xrpl):
    """A platform wallet without a TrustLine to the UCTUSD issuer cannot settle."""
    from app.models.platform_wallet import PlatformWallet
    from tests.conftest import TestingSessionLocal

    db = TestingSessionLocal()
    try:
        db.add(
            PlatformWallet(
                classic_address="rFAKEPLATFORM0000000000000000000",
                secret="sFAKEPLATFORMSECRET",
                trustline_established=False,
            )
        )
        db.commit()
    finally:
        db.close()

    sender_headers = approved_sender()
    remittance_id = _linked_beneficiary_and_quote(client, sender_headers, "r9@example.com", "+27000000709")
    _confirmed_remittance(client, sender_headers, admin_headers, remittance_id)

    run_resp = client.post("/admin/settlement/run", headers=admin_headers)
    results = run_resp.json()
    assert results[0]["status"] == "failed"
    assert "TrustLine" in results[0]["failure_reason"]


def test_settlement_fails_when_platform_iou_balance_insufficient(
    client, approved_sender, admin_headers, platform_wallet_row, mock_xrpl
):
    """Zero on-chain UCTUSD must fail before Payment and point the operator
    at Marc / the distributor for the 100,000 grant."""
    mock_xrpl["iou_balance"] = 0
    sender_headers = approved_sender()
    remittance_id = _linked_beneficiary_and_quote(client, sender_headers, "r10@example.com", "+27000000710")
    _confirmed_remittance(client, sender_headers, admin_headers, remittance_id)

    run_resp = client.post("/admin/settlement/run", headers=admin_headers)
    results = run_resp.json()
    assert results[0]["status"] == "failed"
    reason = results[0]["failure_reason"]
    assert "100,000" in reason
    assert "distributor" in reason.lower()
    assert platform_wallet_row.classic_address in reason


def test_processing_completed_message_again_does_not_double_credit(
    client, approved_sender, admin_headers, platform_wallet_row, mock_xrpl
):
    """FR-25: re-processing an already-COMPLETED message must not credit
    the wallet a second time."""
    from app.services.settlement import process_settlement_message
    from tests.conftest import TestingSessionLocal
    from app.models.settlement import SettlementMessage

    sender_headers = approved_sender()
    remittance_id = _linked_beneficiary_and_quote(client, sender_headers, "r5@example.com", "+27000000705")
    _confirmed_remittance(client, sender_headers, admin_headers, remittance_id)
    client.post("/admin/settlement/run", headers=admin_headers)

    recipient_login = client.post("/auth/login", json={"email": "r5@example.com", "password": "RecipientPass123"})
    recipient_headers = {"Authorization": f"Bearer {recipient_login.json()['access_token']}"}
    balance_after_first = client.get("/wallet/me", headers=recipient_headers).json()["balance_rlusd"]

    db = TestingSessionLocal()
    try:
        message = db.query(SettlementMessage).filter(SettlementMessage.remittance_id == remittance_id).first()
        process_settlement_message(db, message)
    finally:
        db.close()

    balance_after_second = client.get("/wallet/me", headers=recipient_headers).json()["balance_rlusd"]
    assert balance_after_second == balance_after_first


def test_enqueue_settlement_is_idempotent(client, approved_sender, admin_headers):
    from app.services.settlement import enqueue_settlement
    from tests.conftest import TestingSessionLocal
    from app.models.remittance import Remittance
    from app.models.settlement import SettlementMessage

    sender_headers = approved_sender()
    remittance_id = _linked_beneficiary_and_quote(client, sender_headers, "r6@example.com", "+27000000706")
    _confirmed_remittance(client, sender_headers, admin_headers, remittance_id)

    db = TestingSessionLocal()
    try:
        remittance = db.query(Remittance).filter(Remittance.id == remittance_id).first()
        enqueue_settlement(db, remittance)
        enqueue_settlement(db, remittance)
        count = db.query(SettlementMessage).filter(SettlementMessage.remittance_id == remittance_id).count()
        assert count == 1
    finally:
        db.close()


def test_retry_failed_settlement_message(client, approved_sender, admin_headers, platform_wallet_row, mock_xrpl):
    mock_xrpl["should_fail"] = True
    sender_headers = approved_sender()
    remittance_id = _linked_beneficiary_and_quote(client, sender_headers, "r7@example.com", "+27000000707")
    _confirmed_remittance(client, sender_headers, admin_headers, remittance_id)
    client.post("/admin/settlement/run", headers=admin_headers)

    failed = client.get("/admin/settlement?message_status=failed", headers=admin_headers).json()
    message_id = next(m["id"] for m in failed if m["remittance_id"] == remittance_id)

    retry_resp = client.post(f"/admin/settlement/{message_id}/retry", headers=admin_headers)
    assert retry_resp.status_code == 200
    assert retry_resp.json()["status"] == "pending"

    mock_xrpl["should_fail"] = False
    run_resp = client.post("/admin/settlement/run", headers=admin_headers)
    assert run_resp.json()[0]["status"] == "completed"


def test_cannot_retry_non_failed_message(client, approved_sender, admin_headers, platform_wallet_row, mock_xrpl):
    sender_headers = approved_sender()
    remittance_id = _linked_beneficiary_and_quote(client, sender_headers, "r8@example.com", "+27000000708")
    _confirmed_remittance(client, sender_headers, admin_headers, remittance_id)
    client.post("/admin/settlement/run", headers=admin_headers)  # succeeds -> completed

    completed = client.get("/admin/settlement?message_status=completed", headers=admin_headers).json()
    message_id = next(m["id"] for m in completed if m["remittance_id"] == remittance_id)

    resp = client.post(f"/admin/settlement/{message_id}/retry", headers=admin_headers)
    assert resp.status_code == 409


def test_non_admin_cannot_access_settlement_endpoints(client, approved_sender):
    headers = approved_sender()
    assert client.get("/admin/settlement", headers=headers).status_code == 403
    assert client.post("/admin/settlement/run", headers=headers).status_code == 403
    assert client.post("/admin/settlement/some-id/retry", headers=headers).status_code == 403


def test_sender_can_view_own_remittance_history(client, approved_sender):
    """FR-28a."""
    headers_a = approved_sender(email="sa@example.com", mobile="+27000000801")
    headers_b = approved_sender(email="sb@example.com", mobile="+27000000802")
    _linked_beneficiary_and_quote(client, headers_a, "ra@example.com", "+27000000811")

    history_a = client.get("/remittances/me", headers=headers_a).json()
    history_b = client.get("/remittances/me", headers=headers_b).json()
    assert len(history_a) == 1
    assert len(history_b) == 0


# --- Tests below specifically prove Redis is the real transport, not just
# that the end-to-end API result looks right (which the tests above
# already cover and would pass even against the old DB-polling queue). ---


def test_confirm_cash_in_publishes_to_redis_stream(client, approved_sender, admin_headers):
    from app.services.redis_client import get_redis_client
    from app.services.settlement import STREAM_NAME

    sender_headers = approved_sender()
    remittance_id = _linked_beneficiary_and_quote(client, sender_headers, "rr1@example.com", "+27000000901")

    redis_client = get_redis_client()
    assert redis_client.xlen(STREAM_NAME) == 0

    _confirmed_remittance(client, sender_headers, admin_headers, remittance_id)

    assert redis_client.xlen(STREAM_NAME) == 1
    entries = redis_client.xrange(STREAM_NAME, "-", "+")
    published_message_id = entries[0][1]["settlement_message_id"]

    db_message = client.get("/admin/settlement?message_status=pending", headers=admin_headers).json()[0]
    assert published_message_id == db_message["id"]


def test_settlement_run_acks_the_stream_entry(
    client, approved_sender, admin_headers, platform_wallet_row, mock_xrpl
):
    from app.services.redis_client import get_redis_client
    from app.services.settlement import GROUP_NAME, STREAM_NAME

    sender_headers = approved_sender()
    remittance_id = _linked_beneficiary_and_quote(client, sender_headers, "rr2@example.com", "+27000000902")
    _confirmed_remittance(client, sender_headers, admin_headers, remittance_id)

    client.post("/admin/settlement/run", headers=admin_headers)

    redis_client = get_redis_client()
    pending = redis_client.xpending(STREAM_NAME, GROUP_NAME)
    assert pending["pending"] == 0  # acked, not left claimed


def test_retry_republishes_to_redis_stream(
    client, approved_sender, admin_headers, platform_wallet_row, mock_xrpl
):
    from app.services.redis_client import get_redis_client
    from app.services.settlement import STREAM_NAME

    mock_xrpl["should_fail"] = True
    sender_headers = approved_sender()
    remittance_id = _linked_beneficiary_and_quote(client, sender_headers, "rr3@example.com", "+27000000903")
    _confirmed_remittance(client, sender_headers, admin_headers, remittance_id)
    client.post("/admin/settlement/run", headers=admin_headers)

    redis_client = get_redis_client()
    length_after_failure = redis_client.xlen(STREAM_NAME)

    failed = client.get("/admin/settlement?message_status=failed", headers=admin_headers).json()
    message_id = next(m["id"] for m in failed if m["remittance_id"] == remittance_id)
    client.post(f"/admin/settlement/{message_id}/retry", headers=admin_headers)

    assert redis_client.xlen(STREAM_NAME) == length_after_failure + 1


def test_enqueue_republishes_when_stream_entry_id_missing(client, approved_sender, admin_headers):
    """If enqueue committed the DB row but never stored a stream id, a later
    enqueue must XADD again rather than returning the stranded row.
    """
    from app.models.remittance import Remittance
    from app.models.settlement import SettlementMessage
    from app.services.redis_client import get_redis_client
    from app.services.settlement import STREAM_NAME, enqueue_settlement
    from tests.conftest import TestingSessionLocal

    sender_headers = approved_sender()
    remittance_id = _linked_beneficiary_and_quote(client, sender_headers, "rp@example.com", "+27000000910")
    _confirmed_remittance(client, sender_headers, admin_headers, remittance_id)

    redis_client = get_redis_client()
    length_before = redis_client.xlen(STREAM_NAME)

    db = TestingSessionLocal()
    try:
        message = db.query(SettlementMessage).filter(SettlementMessage.remittance_id == remittance_id).first()
        assert message.stream_entry_id is not None
        message.stream_entry_id = None
        db.add(message)
        db.commit()

        remittance = db.query(Remittance).filter(Remittance.id == remittance_id).first()
        republished = enqueue_settlement(db, remittance)
        assert republished.stream_entry_id is not None
        assert redis_client.xlen(STREAM_NAME) == length_before + 1
    finally:
        db.close()


def test_retry_processing_settlement_message(
    client, approved_sender, admin_headers, platform_wallet_row, mock_xrpl
):
    """Stuck PROCESSING (e.g. crash after the PROCESSING commit) must be retryable."""
    from app.models.settlement import SettlementMessage, SettlementMessageStatus
    from tests.conftest import TestingSessionLocal

    sender_headers = approved_sender()
    remittance_id = _linked_beneficiary_and_quote(client, sender_headers, "rproc@example.com", "+27000000911")
    _confirmed_remittance(client, sender_headers, admin_headers, remittance_id)

    db = TestingSessionLocal()
    try:
        message = db.query(SettlementMessage).filter(SettlementMessage.remittance_id == remittance_id).first()
        message.status = SettlementMessageStatus.PROCESSING
        db.add(message)
        db.commit()
        message_id = message.id
    finally:
        db.close()

    retry_resp = client.post(f"/admin/settlement/{message_id}/retry", headers=admin_headers)
    assert retry_resp.status_code == 200
    assert retry_resp.json()["status"] == "pending"

    run_resp = client.post("/admin/settlement/run", headers=admin_headers)
    assert run_resp.status_code == 200
    assert run_resp.json()[0]["status"] == "completed"


def test_retry_pending_settlement_message(client, approved_sender, admin_headers):
    from app.services.redis_client import get_redis_client
    from app.services.settlement import STREAM_NAME

    sender_headers = approved_sender()
    remittance_id = _linked_beneficiary_and_quote(client, sender_headers, "rpend@example.com", "+27000000912")
    _confirmed_remittance(client, sender_headers, admin_headers, remittance_id)

    pending = client.get("/admin/settlement?message_status=pending", headers=admin_headers).json()
    message_id = next(m["id"] for m in pending if m["remittance_id"] == remittance_id)

    length_before = get_redis_client().xlen(STREAM_NAME)
    retry_resp = client.post(f"/admin/settlement/{message_id}/retry", headers=admin_headers)
    assert retry_resp.status_code == 200
    assert retry_resp.json()["status"] == "pending"
    assert get_redis_client().xlen(STREAM_NAME) == length_before + 1


def test_processing_with_existing_hash_does_not_double_credit(
    client, approved_sender, admin_headers, platform_wallet_row, mock_xrpl
):
    """Crash window: Payment succeeded and hash was persisted, status still PROCESSING."""
    from app.models.remittance import Remittance
    from app.models.settlement import SettlementMessage, SettlementMessageStatus
    from app.services.settlement import process_settlement_message
    from tests.conftest import TestingSessionLocal

    sender_headers = approved_sender()
    remittance_id = _linked_beneficiary_and_quote(client, sender_headers, "rhash@example.com", "+27000000913")
    _confirmed_remittance(client, sender_headers, admin_headers, remittance_id)
    client.post("/admin/settlement/run", headers=admin_headers)

    recipient_login = client.post("/auth/login", json={"email": "rhash@example.com", "password": "RecipientPass123"})
    recipient_headers = {"Authorization": f"Bearer {recipient_login.json()['access_token']}"}
    balance_after_first = client.get("/wallet/me", headers=recipient_headers).json()["balance_rlusd"]
    submits_after_first = mock_xrpl["submit_count"]

    db = TestingSessionLocal()
    try:
        message = db.query(SettlementMessage).filter(SettlementMessage.remittance_id == remittance_id).first()
        remittance = db.query(Remittance).filter(Remittance.id == remittance_id).first()
        assert remittance.xrpl_settlement_tx_hash is not None
        message.status = SettlementMessageStatus.PROCESSING
        db.add(message)
        db.commit()
        db.refresh(message)
        process_settlement_message(db, message)
    finally:
        db.close()

    balance_after_second = client.get("/wallet/me", headers=recipient_headers).json()["balance_rlusd"]
    assert balance_after_second == balance_after_first
    assert mock_xrpl["submit_count"] == submits_after_first


def test_mock_payment_same_remittance_id_does_not_double_credit(
    client, approved_sender, admin_headers, platform_wallet_row, mock_xrpl
):
    """On-chain submit already succeeded (mock recorded remittance_id) while the
    DB row is still PROCESSING with no hash — retry must not double-credit.
    """
    from decimal import Decimal as D

    from app.models.remittance import Remittance
    from app.models.settlement import SettlementMessage, SettlementMessageStatus
    from app.models.wallet import RecipientWallet
    from app.services.settlement import process_settlement_message, submit_issued_currency_payment
    from tests.conftest import TestingSessionLocal

    sender_headers = approved_sender()
    remittance_id = _linked_beneficiary_and_quote(client, sender_headers, "rmemo@example.com", "+27000000914")
    _confirmed_remittance(client, sender_headers, admin_headers, remittance_id)

    db = TestingSessionLocal()
    try:
        remittance = db.query(Remittance).filter(Remittance.id == remittance_id).first()
        message = db.query(SettlementMessage).filter(SettlementMessage.remittance_id == remittance_id).first()
        first_hash = submit_issued_currency_payment(
            "sFAKEPLATFORMSECRET",
            "rFAKEDEST",
            remittance.rlusd_amount,
            remittance_id=remittance.id,
        )
        assert mock_xrpl["submit_count"] == 1
        assert mock_xrpl["payments"][remittance.id] == first_hash

        message.status = SettlementMessageStatus.PROCESSING
        db.add(message)
        db.commit()
        db.refresh(message)

        process_settlement_message(db, message)
        db.refresh(message)
        db.refresh(remittance)

        assert message.status == SettlementMessageStatus.COMPLETED
        assert remittance.xrpl_settlement_tx_hash == first_hash
        assert mock_xrpl["payments"][remittance.id] == first_hash

        wallet = (
            db.query(RecipientWallet)
            .filter(RecipientWallet.user_id == remittance.beneficiary.linked_user_id)
            .first()
        )
        balance_after_first_process = wallet.balance

        process_settlement_message(db, message)
        db.refresh(wallet)
        assert wallet.balance == balance_after_first_process
        assert D(wallet.balance) == D(remittance.rlusd_amount)
    finally:
        db.close()


def test_worker_reclaims_unacked_pending_entries(
    client, approved_sender, admin_headers, platform_wallet_row, mock_xrpl
):
    """Entries claimed but not acked (crash mid-flight) must be reclaimed."""
    from app.services.redis_client import get_redis_client
    from app.services.settlement import CONSUMER_NAME, GROUP_NAME, STREAM_NAME, _ensure_consumer_group

    sender_headers = approved_sender()
    remittance_id = _linked_beneficiary_and_quote(client, sender_headers, "rrec@example.com", "+27000000915")
    _confirmed_remittance(client, sender_headers, admin_headers, remittance_id)

    redis_client = get_redis_client()
    _ensure_consumer_group(redis_client)
    claimed = redis_client.xreadgroup(GROUP_NAME, CONSUMER_NAME, {STREAM_NAME: ">"}, count=10)
    assert claimed
    pending = redis_client.xpending(STREAM_NAME, GROUP_NAME)
    assert pending["pending"] >= 1

    run_resp = client.post("/admin/settlement/run", headers=admin_headers)
    assert run_resp.status_code == 200
    assert run_resp.json()[0]["status"] == "completed"
    assert redis_client.xpending(STREAM_NAME, GROUP_NAME)["pending"] == 0

