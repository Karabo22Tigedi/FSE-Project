from decimal import Decimal

from xrpl.models.amounts import IssuedCurrencyAmount
from xrpl.models.requests import AccountLines, AccountTx
from xrpl.models.transactions import Memo, Payment, TrustSet
from xrpl.transaction import submit_and_wait
from xrpl.wallet import Wallet, generate_faucet_wallet

from app.config import get_settings
from app.services.xrpl_client import get_xrpl_client


def generate_and_fund_wallet() -> Wallet:
    """Generate a new XRPL Testnet account and fund it with faucet XRP.

    Free and unlimited, unlike RLUSD/UCTUSD token liquidity (see project
    memory "UCTUSD token details") - safe to call for every recipient.
    """
    return generate_faucet_wallet(get_xrpl_client(), debug=False)


def establish_trustline(wallet: Wallet) -> str:
    """FR-29: TrustSet to the configured issuer/currency so `wallet` can
    hold RLUSD/UCTUSD. Returns the transaction hash."""
    settings = get_settings()
    client = get_xrpl_client()
    trust_set = TrustSet(
        account=wallet.classic_address,
        limit_amount=IssuedCurrencyAmount(
            currency=settings.xrpl_currency_code,
            issuer=settings.xrpl_issuer_address,
            value=settings.xrpl_trustline_limit,
        ),
    )
    response = submit_and_wait(trust_set, client, wallet)
    tx_result = response.result["meta"]["TransactionResult"]
    if tx_result != "tesSUCCESS":
        raise RuntimeError(f"TrustSet failed: {tx_result}")
    return response.result["hash"]


def get_issued_currency_balance(address: str) -> Decimal:
    """Return this address's balance of the configured IOU (UCTUSD).

    Queries account_lines and sums trust lines whose currency matches
    ``settings.xrpl_currency_code`` and whose counterparty (``account``)
    is ``settings.xrpl_issuer_address``. Returns Decimal("0") if no
    matching line exists.
    """
    settings = get_settings()
    client = get_xrpl_client()
    total = Decimal("0")
    marker = None
    while True:
        request_kwargs: dict = {"account": address}
        if marker is not None:
            request_kwargs["marker"] = marker
        response = client.request(AccountLines(**request_kwargs))
        result = response.result
        for line in result.get("lines") or []:
            if (
                line.get("currency") == settings.xrpl_currency_code
                and line.get("account") == settings.xrpl_issuer_address
            ):
                total += Decimal(str(line.get("balance", "0")))
        marker = result.get("marker")
        if marker is None:
            break
    return total


def _payment_memos(remittance_id: str | None) -> list[Memo] | None:
    if not remittance_id:
        return None
    return [
        Memo(
            memo_data=remittance_id.encode("utf-8").hex(),
            memo_type="remittance_id".encode("utf-8").hex(),
        )
    ]


def find_validated_payment_hash(account: str, correlation_id: str) -> str | None:
    """FR-25: return the hash of a tesSUCCESS Payment on `account` whose
    remittance_id memo matches `correlation_id`, or None if none found.

    Paginates account_tx (limit 200, at most 20 pages). Does not catch
    errors — a failed lookup must raise so the caller does not pay blind.
    """
    expected_type = "remittance_id".encode().hex().upper()
    expected_data = correlation_id.encode("utf-8").hex().upper()
    client = get_xrpl_client()
    marker = None
    for _ in range(20):
        request_kwargs: dict = {"account": account, "limit": 200}
        if marker is not None:
            request_kwargs["marker"] = marker
        result = client.request(AccountTx(**request_kwargs)).result
        for entry in result.get("transactions") or []:
            tx = entry.get("tx") or entry.get("tx_json") or {}
            if tx.get("TransactionType") != "Payment":
                continue
            meta = entry.get("meta")
            if not isinstance(meta, dict) or meta.get("TransactionResult") != "tesSUCCESS":
                continue
            for memo_wrapper in tx.get("Memos") or []:
                if isinstance(memo_wrapper, dict) and "Memo" in memo_wrapper:
                    memo = memo_wrapper["Memo"]
                else:
                    memo = memo_wrapper
                if not isinstance(memo, dict):
                    continue
                memo_type = str(memo.get("MemoType") or "").upper()
                memo_data = str(memo.get("MemoData") or "").upper()
                if memo_type == expected_type and memo_data == expected_data:
                    found = entry.get("hash") or tx.get("hash")
                    if found:
                        return found
        marker = result.get("marker")
        if marker is None:
            break
    return None


def submit_issued_currency_payment(
    from_seed: str,
    destination_address: str,
    amount: Decimal,
    remittance_id: str | None = None,
) -> str:
    """FR-22: submit a Payment transaction moving RLUSD/UCTUSD on-chain.

    Takes the sender's seed directly (rather than a Wallet object) so
    callers never need to construct a Wallet themselves - keeps the one
    place private keys get materialised into signing objects contained
    here (NFR-05).

    `remittance_id` is written as XRPL MemoData so a Payment can be
    correlated with the remittance it settles. It is optional so older
    call sites and tests keep working.

    FR-25: if `remittance_id` is set, look up an already-validated Payment
    with that memo on the sender account and return its hash instead of
    submitting again.

    Returns the transaction hash. Raises RuntimeError if the ledger
    reports anything other than tesSUCCESS - e.g. tecUNFUNDED_PAYMENT if
    the sender lacks sufficient token balance, or tecNO_LINE if the
    destination hasn't trusted the issuer.
    """
    settings = get_settings()
    client = get_xrpl_client()
    wallet = Wallet.from_seed(from_seed)

    if remittance_id:
        existing = find_validated_payment_hash(wallet.classic_address, remittance_id)
        if existing:
            return existing

    payment_kwargs = dict(
        account=wallet.classic_address,
        destination=destination_address,
        amount=IssuedCurrencyAmount(
            currency=settings.xrpl_currency_code,
            issuer=settings.xrpl_issuer_address,
            value=str(amount),
        ),
    )
    memos = _payment_memos(remittance_id)
    if memos is not None:
        payment_kwargs["memos"] = memos

    payment = Payment(**payment_kwargs)
    response = submit_and_wait(payment, client, wallet)
    tx_result = response.result["meta"]["TransactionResult"]
    if tx_result != "tesSUCCESS":
        raise RuntimeError(f"Payment failed: {tx_result}")
    return response.result["hash"]
