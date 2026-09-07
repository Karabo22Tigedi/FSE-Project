# Performance Testing Results

Re-run on this fork (`Karabo22Tigedi/FSE-Project`) on **2026-09-07**, against the live local demo stack on a Windows laptop (`uvicorn app.main:app`, SQLite, single process, Redis on `localhost:6379`). Absolute numbers are indicative of this host (including OneDrive-backed SQLite), not a production capacity guarantee. Relative comparisons — which endpoints are slow, what dominates settlement — are the useful result.

Kerry-Lynn Whyte’s sketch measurements from **2026-08-31** (HTTP) and **2026-09-01** (Redis enqueue + five live Testnet settlements) remain in `backend/perf/results/run1_*.csv` for comparison. HTTP load, queue enqueue, and five live Testnet settlements were all re-run on this fork on **2026-09-07**.

## 1. API load test (NFR-01, NFR-02)

**Setup:** 50 synthetic KYC-approved sender accounts (`python -m scripts.seed_synthetic_users 50`). The seed raises the verified daily/monthly limits so quote creation measures API time rather than FR-16/17 gating (already covered by pytest). Locust (`backend/perf/locustfile.py`), 50 concurrent users, spawn 10/s, 60 s, mix of profile / KYC status / limits / beneficiaries / wallet plus quote creation. Quote amounts are **R100–R500** so they sit above the default R25 fixed fee — this fork returns 422 when fees consume the principal. Settlement and anything that lazily funds a real XRPL account are excluded (see §2).

Verified limits were restored to the demo defaults (R3,000 / R25,000) after the run. Load-test quotes were deleted; the 50 `loadtest-sender-*` accounts remain (re-seeding is idempotent).

**Result: 2,218 requests, 0 failures, 37.2 req/s aggregate throughput.**

| Endpoint | Requests | Median (ms) | Avg (ms) | p95 (ms) | p99 (ms) | Max (ms) |
|---|---:|---:|---:|---:|---:|---:|
| `POST /auth/login` | 50 | 850 | 855 | 1,200 | 1,300 | 1,277 |
| `GET /users/me` | 453 | 20 | 40 | 79 | 750 | 1,200 |
| `GET /kyc/me/status` | 299 | 23 | 43 | 110 | 520 | 779 |
| `GET /limits/me` | 339 | 32 | 56 | 140 | 570 | 942 |
| `GET /beneficiaries` | 300 | 23 | 45 | 110 | 690 | 1,012 |
| `GET /wallet/me` | 316 | 33 | 63 | 200 | 590 | 1,129 |
| `POST /remittances` (quote) | 461 | 66 | 106 | 320 | 860 | 1,370 |
| **Aggregated** | 2,218 | 35 | 79 | 290 | 930 | 1,370 |

Charts: [`backend/perf/results/charts.html`](backend/perf/results/charts.html) (inline SVG), plus [`response_times.svg`](backend/perf/results/response_times.svg) and [`rps_history.svg`](backend/perf/results/rps_history.svg). Full Locust report: [`backend/perf/results/run2.html`](backend/perf/results/run2.html). Raw CSVs: `run2_stats.csv`, `run2_stats_history.csv`.

**NFR-01 (response within 2 s under normal conditions):** met — every endpoint’s p99 is under 1.4 s, and the slowest request in the run (1,370 ms, a quote during the login spawn) is still inside the 2 s budget. After spawn, authenticated reads sit around 20–35 ms median.

**NFR-02 (stable under ~50 concurrent users):** met — zero failures across 2,218 requests. Throughput climbed with the spawn and then held ~37–39 req/s for the rest of the minute (Figure 2). No error spike, no collapse.

**Bottleneck — login latency (bcrypt):** `/auth/login` is ~25–40× slower than the read endpoints (~850 ms median vs ~20–33 ms). That is bcrypt password verification, deliberately expensive (NFR-03), not a defect. On a single uvicorn worker the 50 logins at spawn also briefly stall SQLite-backed reads (p99 of `/users/me` etc. in the hundreds of ms, while the median stays low). At this scale it still clears 2 s; the first place to look for higher login rates would be bcrypt work factor, more workers, or refresh tokens so password checks happen less often.

## 2. Message-queue throughput and RLUSD/UCTUSD settlement time

Measured separately from the HTTP mix (`scripts/benchmark_settlement.py`) because settlement makes real JSON-RPC calls to XRPL Testnet.

**Queue enqueue and settlement (re-measured 2026-09-07 on this fork):** 200 `enqueue_settlement` calls (SQLite insert + commit, Redis `XADD`, then a second commit storing `stream_entry_id`), then five live treasury-to-recipient Testnet Payments. Enqueue-only entries were removed from the stream afterwards so they could not sit ahead of demo work.

| Metric | Result | When |
|---|---|---|
| Message-queue enqueue throughput (this host) | 200 messages in 6.839 s → **29.2 msg/s** | 2026-09-07, this fork |
| Message-queue enqueue throughput (sketch, same Redis Streams path) | 200 messages in 0.387 s → **517 msg/s** | 2026-09-01, Kerry’s machine |
| RLUSD/UCTUSD settlement processing time | 5 real Testnet transactions in 87.486 s → **17.5 s/transaction avg** | 2026-09-07, this fork |
| Settlement success rate (this sample) | 5/5 (100%) | 2026-09-07 |
| Prior Testnet sample (same script, Kerry’s machine) | 5 txs in 61.9 s → 12.4 s/tx, 5/5 | 2026-09-01 |

**Bottleneck — enqueue I/O on this host:** 29 msg/s is plenty next to a ~17 s ledger wait, but it is far below the sketch’s 517 msg/s. Two SQLite commits per enqueue (outbox row, then `stream_entry_id`) plus Redis `XADD`, on a OneDrive-backed `.db` file, dominate. That is host I/O and the crash-safe outbox, not a missing index. A local SSD SQLite or Postgres would look much closer to the 2026-09-01 figure.

**Bottleneck — XRPL ledger close time:** enqueueing is not the ceiling. Each settlement submits a Payment and waits for Testnet to close and validate (`submit_and_wait`). XRPL targets a ~3–5 s ledger; the 17.5 s average includes Testnet jitter and `LastLedgerSequence` retries (the 2026-08-31 sample was also ~17 s/tx; 2026-09-01 was 12.4 s/tx). Application code in `app/services/settlement.py` cannot shrink ledger consensus. If volume ever needed to exceed one-in-flight per worker, add consumers to the `settlement_workers` Redis group rather than micro-optimising the per-tx path.

## 3. Concurrent-use behaviour and failure rates

- 0 failures across the 50-user, 60 s HTTP run (§1). HTTP success rate **100%** (2,218 / 2,218).
- An earlier 60 s attempt used the sketch locust mix (R10–R100). About 18% of `POST /remittances` returned 422 because the default R25 fee consumed the principal — a correctness guard on this fork, not an overload failure. The locustfile now uses R100–R500; that mix is what §1 reports.
- Settlement success **5/5** on the 2026-09-07 Testnet sample (`tesSUCCESS`, no retries). The 2026-09-01 sample was also 5/5.
- Failed-settlement must not credit the recipient (FR-24) is a correctness property in `backend/tests/test_settlement.py` (mocked XRPL), not a live load test. The suite currently collects **129** pytest tests.

## How to reproduce (Windows)

Redis must already be on `localhost:6379` (Memurai, `docker run -d -p 6379:6379 redis`, or WSL `redis-server`). Homebrew `brew services start redis` is optional on macOS, not required here.

API on `http://127.0.0.1:8000` (`GET /health` → `{"status":"ok"}`). Locust is in `backend/requirements.txt` (`locust==2.46.0`); install into the project venv only if missing.

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m scripts.seed_synthetic_users 50

# Terminal A — if the API is not already up:
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# Terminal B
python -m locust -f perf/locustfile.py --host=http://127.0.0.1:8000 `
    --users 50 --spawn-rate 10 --run-time 60s --headless `
    --csv=perf/results/run2 --html=perf/results/run2.html
python perf/render_charts.py

# Restore demo verified limits (seed raises them so quotes are not FR-16 gated)
python -c "from decimal import Decimal; from app.database import SessionLocal; from app.models.limit_tier import LimitTier, LimitTierKey; db=SessionLocal(); t=db.query(LimitTier).filter(LimitTier.tier_key==LimitTierKey.VERIFIED).first(); t.daily_limit_zar=Decimal('3000'); t.monthly_limit_zar=Decimal('25000'); db.add(t); db.commit(); db.close(); print('verified limits restored')"
```

Optional enqueue-only timing (creates then deletes 200 synthetic remittances; leaves `benchmark-sender@example.com` / `benchmark-recipient@example.com`). Omit `--enqueue-only` only if you intend five live Testnet Payments from the demo treasury. The 17.5 s/tx figures in §2 are the 2026-09-07 sample.

```powershell
python -m scripts.benchmark_settlement --enqueue-only
python -m scripts.benchmark_settlement 5
```

`perf/synthetic_users.json` is gitignored. Charts and Locust HTML live under `backend/perf/results/`.
