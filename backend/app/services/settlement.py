from datetime import datetime, timezone

import redis
from sqlalchemy.orm import Session as DBSession

from app.core.money import to_decimal
from app.models.remittance import Remittance, RemittanceStatus
from app.models.settlement import SettlementMessage, SettlementMessageStatus
from app.services.platform_wallet import get_platform_wallet_row
from app.services.recipient_wallet import ensure_xrpl_account, get_or_create_wallet_row
from app.services.redis_client import get_redis_client
from app.services.xrpl_provisioning import submit_issued_currency_payment

# FR-21/22: the settlement queue, as a Redis Stream (basics.pdf recommends
# RabbitMQ/Redis Streams over a DB-polling table). Entries just carry a
# SettlementMessage id - the durable record of status/outcome/tx-hash stays
# in that DB row (FR-23/NFR-09 need it queryable regardless of queue tech),
# so the stream is purely the transport that wakes a consumer up.
STREAM_NAME = "settlement_messages"
GROUP_NAME = "settlement_workers"
CONSUMER_NAME = "worker-1"  # FR-22 names "a settlement worker", singular

_TERMINAL_STATUSES = frozenset(
    {SettlementMessageStatus.COMPLETED, SettlementMessageStatus.FAILED}
)
_RETRYABLE_STATUSES = frozenset(
    {
        SettlementMessageStatus.FAILED,
        SettlementMessageStatus.PROCESSING,
        SettlementMessageStatus.PENDING,
    }
)


def _ensure_consumer_group(client: redis.Redis) -> None:
    try:
        client.xgroup_create(STREAM_NAME, GROUP_NAME, id="0", mkstream=True)
    except redis.ResponseError as exc:
        if "BUSYGROUP" not in str(exc):
            raise


def _stream_entry_exists(client: redis.Redis, entry_id: str | None) -> bool:
    if not entry_id:
        return False
    try:
        return bool(client.xrange(STREAM_NAME, min=entry_id, max=entry_id))
    except redis.RedisError:
        return False


def _publish_to_stream(db: DBSession, message: SettlementMessage) -> SettlementMessage:
    client = get_redis_client()
    _ensure_consumer_group(client)
    entry_id = client.xadd(STREAM_NAME, {"settlement_message_id": message.id})
    message.stream_entry_id = entry_id
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


def _needs_republish(client: redis.Redis, message: SettlementMessage) -> bool:
    if message.status not in (
        SettlementMessageStatus.PENDING,
        SettlementMessageStatus.PROCESSING,
    ):
        return False
    return not _stream_entry_exists(client, message.stream_entry_id)


def enqueue_settlement(db: DBSession, remittance: Remittance) -> SettlementMessage:
    """FR-21: place a settlement message on the queue once cash-in is
    confirmed. Idempotent per remittance - the unique constraint on
    remittance_id means calling this twice for the same remittance just
    returns the existing message rather than creating a second one.

    If the existing row is still PENDING/PROCESSING but was never
    successfully published (no stream_entry_id, or the stream no longer
    holds that id), republish so Redis failure after the DB commit cannot
    strand the remittance.
    """
    existing = db.query(SettlementMessage).filter(SettlementMessage.remittance_id == remittance.id).first()
    if existing is not None:
        if _needs_republish(get_redis_client(), existing):
            return _publish_to_stream(db, existing)
        return existing

    message = SettlementMessage(remittance_id=remittance.id)
    db.add(message)
    remittance.status = RemittanceStatus.SETTLEMENT_QUEUED
    db.add(remittance)
    db.commit()
    db.refresh(message)

    return _publish_to_stream(db, message)


def retry_settlement_message(db: DBSession, message: SettlementMessage) -> SettlementMessage:
    """Reset a stuck or failed message and re-publish it to the stream.

    Redis does not redeliver an already-acked entry, so FAILED messages
    need an explicit republish. PROCESSING/PENDING can also get stuck
    (worker crash, XADD never stored) and are therefore retryable too.
    """
    message.status = SettlementMessageStatus.PENDING
    message.failure_reason = None
    db.add(message)

    message.remittance.status = RemittanceStatus.SETTLEMENT_QUEUED
    message.remittance.settlement_failure_reason = None
    db.add(message.remittance)

    db.commit()
    db.refresh(message)

    return _publish_to_stream(db, message)


def _mark_completed_from_existing_hash(db: DBSession, message: SettlementMessage) -> SettlementMessage:
    """Idempotent finish: on-chain Payment already recorded. Do not credit again."""
    remittance = message.remittance
    remittance.status = RemittanceStatus.SETTLED
    if remittance.settled_at is None:
        remittance.settled_at = datetime.now(timezone.utc)
    db.add(remittance)

    message.status = SettlementMessageStatus.COMPLETED
    if message.processed_at is None:
        message.processed_at = datetime.now(timezone.utc)
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


def process_settlement_message(db: DBSession, message: SettlementMessage) -> SettlementMessage:
    """FR-22: consume one queued message and submit the corresponding
    RLUSD/UCTUSD Payment to the XRP Ledger Testnet, from the platform
    treasury wallet to the recipient's own custodial account.

    FR-24: on failure, the recipient's wallet balance is left untouched
    and the failure reason is recorded on both the message and the
    remittance.
    FR-25: a message already COMPLETED is a no-op rather than crediting
    the wallet again. A remittance that already has xrpl_settlement_tx_hash
    is also treated as settled (crash after a successful Payment).
    FR-26: on success, the recipient's cached ledger balance is credited.
    """
    if message.status == SettlementMessageStatus.COMPLETED:
        return message

    remittance = message.remittance
    if remittance.xrpl_settlement_tx_hash:
        return _mark_completed_from_existing_hash(db, message)

    beneficiary = remittance.beneficiary

    message.status = SettlementMessageStatus.PROCESSING
    message.attempts += 1
    db.add(message)
    db.commit()

    try:
        if remittance.xrpl_settlement_tx_hash:
            return _mark_completed_from_existing_hash(db, message)

        if beneficiary.linked_user_id is None:
            raise RuntimeError("Beneficiary is not linked to a registered recipient account")

        platform_wallet_row = get_platform_wallet_row(db)
        if platform_wallet_row is None:
            raise RuntimeError("Platform wallet is not set up")

        recipient_wallet_row = get_or_create_wallet_row(db, beneficiary.linked_user_id)
        recipient_wallet_row = ensure_xrpl_account(db, recipient_wallet_row)

        if remittance.xrpl_settlement_tx_hash or message.status == SettlementMessageStatus.COMPLETED:
            return _mark_completed_from_existing_hash(db, message)

        tx_hash = submit_issued_currency_payment(
            platform_wallet_row.secret,
            recipient_wallet_row.xrpl_address,
            remittance.rlusd_amount,
            remittance.id,
        )

        db.refresh(message)
        db.refresh(remittance)
        db.refresh(recipient_wallet_row)

        if message.status == SettlementMessageStatus.COMPLETED or remittance.xrpl_settlement_tx_hash:
            return _mark_completed_from_existing_hash(db, message)

        recipient_wallet_row.balance = to_decimal(recipient_wallet_row.balance) + remittance.rlusd_amount
        db.add(recipient_wallet_row)

        remittance.status = RemittanceStatus.SETTLED
        remittance.xrpl_settlement_tx_hash = tx_hash
        remittance.settled_at = datetime.now(timezone.utc)
        db.add(remittance)

        message.status = SettlementMessageStatus.COMPLETED
        message.processed_at = datetime.now(timezone.utc)
        db.add(message)
        db.commit()
    except Exception as exc:
        db.rollback()

        message.status = SettlementMessageStatus.FAILED
        message.failure_reason = str(exc)
        message.processed_at = datetime.now(timezone.utc)
        db.add(message)

        remittance.status = RemittanceStatus.SETTLEMENT_FAILED
        remittance.settlement_failure_reason = str(exc)
        db.add(remittance)
        db.commit()

    db.refresh(message)
    return message


def _handle_stream_entry(
    db: DBSession,
    client: redis.Redis,
    entry_id: str,
    fields: dict,
    results: list[SettlementMessage],
) -> None:
    settlement_message_id = fields.get("settlement_message_id")
    message = db.query(SettlementMessage).filter(SettlementMessage.id == settlement_message_id).first()
    if message is None:
        client.xack(STREAM_NAME, GROUP_NAME, entry_id)
        return

    processed = process_settlement_message(db, message)
    results.append(processed)
    if processed.status in _TERMINAL_STATUSES:
        client.xack(STREAM_NAME, GROUP_NAME, entry_id)


_use_xautoclaim: bool | None = None


def _parse_xautoclaim(result) -> tuple[str, list]:
    """redis-py returns [next_id, messages] or [next_id, messages, deleted]."""
    next_id = result[0]
    messages = result[1] if len(result) > 1 else []
    return next_id, messages or []


def _pending_message_ids(client: redis.Redis, batch_size: int) -> list[str]:
    # Do not pass IDLE: Redis 5.x (Memurai) rejects it as a syntax error.
    pending = client.xpending_range(STREAM_NAME, GROUP_NAME, "-", "+", batch_size)
    if not pending:
        return []
    ids: list[str] = []
    for item in pending:
        if isinstance(item, dict):
            ids.append(item["message_id"])
        else:
            ids.append(item[0])
    return ids


def _claim_idle_entries(client: redis.Redis, batch_size: int, min_idle_ms: int) -> list:
    """Claim idle PEL entries from any consumer. Prefer XAUTOCLAIM (Redis 6.2+);
    fall back to XPENDING + XCLAIM on Redis 5. Errors are swallowed so the
    worker can still drain new `>` entries.
    """
    global _use_xautoclaim
    try:
        if _use_xautoclaim is not False:
            try:
                claimed = client.xautoclaim(
                    STREAM_NAME, GROUP_NAME, CONSUMER_NAME, min_idle_ms, "0-0", count=batch_size
                )
                _use_xautoclaim = True
                _next_id, messages = _parse_xautoclaim(claimed)
                return messages
            except (redis.ResponseError, AttributeError, TypeError):
                _use_xautoclaim = False

        ids = _pending_message_ids(client, batch_size)
        if not ids:
            return []
        return client.xclaim(STREAM_NAME, GROUP_NAME, CONSUMER_NAME, min_idle_ms, ids) or []
    except redis.RedisError:
        return []


def _reclaim_pending_entries(
    db: DBSession,
    client: redis.Redis,
    batch_size: int,
    min_idle_ms: int,
    results: list[SettlementMessage],
    seen_ids: set[str],
) -> None:
    """Reclaim this consumer's PEL (XREADGROUP id 0) and idle pending
    entries owned by any consumer (XAUTOCLAIM / XCLAIM), then process them.
    Do not ack until process_settlement_message reaches COMPLETED or FAILED.
    """
    while True:
        try:
            response = client.xreadgroup(GROUP_NAME, CONSUMER_NAME, {STREAM_NAME: "0"}, count=batch_size)
        except redis.RedisError:
            break
        if not response:
            break
        new_work = 0
        entries_seen = 0
        for _stream_name, entries in response:
            entries_seen += len(entries)
            for entry_id, fields in entries:
                if entry_id in seen_ids:
                    continue
                seen_ids.add(entry_id)
                new_work += 1
                _handle_stream_entry(db, client, entry_id, fields, results)
        if new_work == 0 or entries_seen < batch_size:
            break

    while True:
        messages = _claim_idle_entries(client, batch_size, min_idle_ms)
        if not messages:
            break
        new_work = 0
        for entry_id, fields in messages:
            if entry_id in seen_ids:
                continue
            seen_ids.add(entry_id)
            new_work += 1
            _handle_stream_entry(db, client, entry_id, fields, results)
        if new_work == 0 or len(messages) < batch_size:
            break


def process_pending_settlements(
    db: DBSession,
    batch_size: int = 50,
    block_ms: int = 200,
    min_idle_ms: int = 1000,
) -> list[SettlementMessage]:
    """FR-22: the settlement worker's main loop body - reclaim any stuck
    pending-entry-list items, then drain new `>` entries.

    Acks only after process_settlement_message has reached COMPLETED or
    FAILED, so a crash mid-flight leaves the entry in the PEL for reclaim.
    """
    client = get_redis_client()
    _ensure_consumer_group(client)

    results: list[SettlementMessage] = []
    seen_ids: set[str] = set()

    _reclaim_pending_entries(db, client, batch_size, min_idle_ms, results, seen_ids)

    while True:
        response = client.xreadgroup(
            GROUP_NAME, CONSUMER_NAME, {STREAM_NAME: ">"}, count=batch_size, block=block_ms
        )
        if not response:
            break

        entries_seen = 0
        for _stream_name, entries in response:
            entries_seen += len(entries)
            for entry_id, fields in entries:
                if entry_id in seen_ids:
                    continue
                seen_ids.add(entry_id)
                _handle_stream_entry(db, client, entry_id, fields, results)

        if entries_seen < batch_size:
            break

    return results
