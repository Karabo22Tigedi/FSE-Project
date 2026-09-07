# XRPL-Based FX Remittance Platform (RLUSD)

UCT ECO5040W **Group 3** (Annita Ngoma, Karabo Tigedi, Kerry-Lynn Whyte).

This repository is **our** fork (`Karabo22Tigedi/FSE-Project`). Kerry’s earlier GitHub tree was a working sketch. The API here is the patched system (quote TTL and cancel, hashed sessions, Alembic, settlement outbox / PEL reclaim, honest wallet balances). **113** pytest tests passed on this tree.

Academic prototype only: simulated ZAR cash-in, RLUSD/UCTUSD settlement on the XRP Ledger **Testnet**, simulated fiat cash-out. No real customer funds, no Mainnet credentials.

## Reports (deliverable i)

Compiled PDFs (run `powershell -File docs/reports/compile.ps1`):

- [Business and technical specification](docs/reports/spec/business_technical_specification.pdf) (official 10–15 page spec)
- [Group rationale](docs/reports/rationale/group_rationale.pdf)

LaTeX sources live next to those PDFs. Kerry’s old `ASSUMPTIONS_AND_LIMITATIONS.md` listed sketch bugs as if they were current; it is now a pointer to the spec.

## What we changed versus the sketch

- **Alembic** `0001_initial` + `0002_quote_session` at runtime (startup runs `upgrade head`). Tests still `create_all` on in-memory SQLite.
- **Quotes:** 15-minute TTL, `POST /remittances/{id}/cancel`, tracking ref `MG` + 10 digits, `GET /remittances/track/{ref}`. Cancelled and expired quotes **do not** count toward limits. Sends whose fees consume the principal return **422**.
- **Settlement:** Redis outbox `stream_entry_id`; ack only on `completed`/`failed`; PEL reclaim (Redis 6.2 `XAUTOCLAIM` or Redis 5 `XCLAIM`); retry pending/processing/failed; Payment memo = remittance id; no second pay if `xrpl_settlement_tx_hash` is set.
- **Wallets:** persist XRPL address **before** TrustSet. `GET /wallet/me` exposes `balance_rlusd` = spendable, plus `spendable_balance` and `on_chain_balance` (spendable + non-failed cash-outs). Simulated cash-out does not burn on-chain tokens.
- **Sessions:** bcrypt passwords; SHA-256 `token_hash` at rest (raw token returned once at login).
- **Crypto:** bad Fernet ciphertext raises rather than returning empty; two keys (KYC vs XRPL).
- **CORS** for localhost UI origins (5173 / 3000 / 8000).

## Stack

FastAPI + SQLAlchemy + SQLite (dev). Redis Streams for settlement transport (DB row is source of truth). `xrpl-py` against Testnet JSON-RPC. USD/ZAR from [open.er-api.com](https://open.er-api.com/v6/latest/USD), cached 5 minutes, `.env` fallback (`USD_ZAR_RATE`). Interactive API: `http://127.0.0.1:8000/docs`.

## Running locally (Windows)

Redis must be listening on `localhost:6379`. Use **Memurai**, **Docker** (`docker run -d -p 6379:6379 redis`), **WSL** `redis-server`, or another Redis 5+ build. (macOS Homebrew is optional, not the only path.)

In **PowerShell**:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Generate **two different** Fernet keys and put them in `.env` as `KYC_ENCRYPTION_KEY` and `XRPL_KEY_ENCRYPTION_KEY`:

```powershell
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Prefer a **fresh** SQLite file, then migrate (app startup does this too):

```powershell
.\.venv\Scripts\alembic upgrade head
python -m uvicorn app.main:app --reload
```

API docs: http://127.0.0.1:8000/docs

Create an admin (not via public register):

```powershell
python -m scripts.create_admin "Admin Name" admin@example.com +27000000000 <password>
```

Once per environment, platform Testnet wallet (prints the **address** only):

```powershell
python -m scripts.setup_platform_wallet
```

Settlement worker (or `POST /admin/settlement/run` while logged in as admin):

```powershell
python -m scripts.run_settlement_worker
```

Leftover DBs created only with `create_all` (no `alembic_version`) will fail `upgrade`. Start from an empty file for demos.

## Tests

Redis must be running. XRPL calls are mocked; tests use Redis DB 15.

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m pytest -q
```

## Performance numbers

[`PERFORMANCE_TESTING.md`](PERFORMANCE_TESTING.md) is Kerry’s Locust / Testnet baseline (2026-08-31 / 09-01). It was **not** re-run on this patched fork.
