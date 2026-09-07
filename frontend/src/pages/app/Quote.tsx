import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { api } from "../../api/client"
import { ApiError } from "../../api/types"
import type { CashInMethod, Remittance } from "../../api/types"
import {
  cashInLabel,
  errorDetail,
  formatCountdown,
  formatDateTime,
  isExpired,
} from "./format"
import {
  QuoteBreakdown,
  RemittanceBadge,
  StatusTimeline,
  TxHash,
  staggerStyle,
} from "./StatusTimeline"

const CASH_IN_METHODS: { value: CashInMethod; hint: string }[] = [
  { value: "agent_cash", hint: "Pay ZAR in cash at a partner agent." },
  { value: "bank_transfer", hint: "EFT into the platform holding account." },
  { value: "card", hint: "Simulated card payment." },
]

export function Quote() {
  const { id } = useParams<{ id: string }>()
  const [remittance, setRemittance] = useState<Remittance | null>(null)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [method, setMethod] = useState<CashInMethod>("agent_cash")
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) {
        setMissing(true)
        setLoading(false)
        return
      }
      setError("")
      try {
        const list = await api.myRemittances()
        if (cancelled) return
        const found = list.find((item) => item.id === id) ?? null
        setRemittance(found)
        setMissing(!found)
      } catch (err) {
        if (!cancelled) setError(errorDetail(err, "Could not load this quote"))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  const quotedLive =
    remittance?.status === "quoted" && !isExpired(remittance.expires_at, now)

  useEffect(() => {
    if (remittance?.status !== "quoted") return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [remittance?.status])

  async function reloadQuote() {
    if (!id) return
    const list = await api.myRemittances()
    const found = list.find((item) => item.id === id) ?? null
    setRemittance(found)
    setMissing(!found)
  }

  async function onCancel() {
    if (!remittance) return
    setError("")
    setActing(true)
    try {
      const updated = await api.cancelQuote(remittance.id)
      setRemittance(updated)
      setConfirmCancel(false)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        try {
          await reloadQuote()
        } catch {
          /* keep the quote we already have */
        }
      }
      setError(errorDetail(err, "Could not cancel"))
    } finally {
      setActing(false)
    }
  }

  async function onCashIn() {
    if (!remittance) return
    setError("")
    setActing(true)
    try {
      const updated = await api.cashIn(remittance.id, method)
      setRemittance(updated)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        try {
          await reloadQuote()
        } catch {
          /* keep the quote we already have */
        }
      }
      setError(errorDetail(err, "Could not start cash-in"))
    } finally {
      setActing(false)
    }
  }

  const expiredQuoted =
    remittance?.status === "quoted" && isExpired(remittance.expires_at, now)

  return (
    <>
      <h1>Quote</h1>
      {remittance ? (
        <p className="page-lead">
          <RemittanceBadge status={remittance.status} expired={expiredQuoted} />{" "}
          <span className="mono">{remittance.tracking_ref}</span>
        </p>
      ) : (
        <p className="page-lead">Locked fee, FX margin, and UCTUSD for this send.</p>
      )}
      {loading ? <p className="muted">Loading quote…</p> : null}
      {error ? <p className="banner banner--error">{error}</p> : null}

      {missing && !loading ? (
        <article className="app-card stagger-in" style={staggerStyle(0)}>
          <h2>Quote not found</h2>
          <p className="empty-state">This quote is not in your history.</p>
          <div className="action-row">
            <Link className="pill" to="/app/history">
              History
            </Link>
            <Link className="pill pill--ghost" to="/app/send">
              New quote
            </Link>
          </div>
        </article>
      ) : null}

      {remittance ? (
        <>
          {remittance.status === "cancelled" ? (
            <p className="banner banner--warn">This quote was cancelled. The limit hold was released.</p>
          ) : null}
          {expiredQuoted ? (
            <p className="banner banner--error">
              This quote expired at {formatDateTime(remittance.expires_at)}. Cash-in is no longer
              available.
            </p>
          ) : null}
          {quotedLive ? (
            <p className="banner banner--ok">
              Expires {formatDateTime(remittance.expires_at)} · {formatCountdown(remittance.expires_at, now)}
            </p>
          ) : null}
          {remittance.status === "cash_in_pending" ? (
            <p className="banner banner--ok">
              Cash-in started
              {remittance.cash_in_method ? ` (${cashInLabel(remittance.cash_in_method)})` : ""}. An
              administrator must confirm receipt before settlement can run.
            </p>
          ) : null}
          {remittance.status === "cash_in_confirmed" || remittance.status === "settlement_queued" ? (
            <p className="banner banner--ok">
              Cash-in is confirmed and settlement is queued. An administrator needs to run the
              settlement worker.
            </p>
          ) : null}
          {remittance.status === "settled" ? (
            <p className="banner banner--ok">Settled on XRPL.</p>
          ) : null}
          {remittance.status === "settlement_failed" ? (
            <p className="banner banner--error">
              {remittance.settlement_failure_reason ?? "Settlement failed."}
            </p>
          ) : null}

          <article className="app-card stagger-in" style={staggerStyle(0)}>
            <h2>Locked quote</h2>
            <QuoteBreakdown remittance={remittance} />
            <TxHash hash={remittance.xrpl_settlement_tx_hash} />
            <div className="action-row">
              <Link className="pill pill--ghost" to={`/app/track/${remittance.tracking_ref}`}>
                Track
              </Link>
              <Link className="pill pill--ghost" to="/app/history">
                History
              </Link>
            </div>
          </article>

          <article className="app-card stagger-in" style={staggerStyle(1)}>
            <h2>Status</h2>
            <StatusTimeline status={remittance.status} expired={expiredQuoted} />
          </article>

          {quotedLive ? (
            <article className="app-card stagger-in" style={staggerStyle(2)}>
              <h2>Cash in or cancel</h2>
              <p className="muted">Choose a simulated ZAR cash-in method, or cancel while the quote is still live.</p>
              <div className="method-grid">
                {CASH_IN_METHODS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={method === item.value ? "is-on" : undefined}
                    onClick={() => setMethod(item.value)}
                    disabled={acting}
                  >
                    <strong>{cashInLabel(item.value)}</strong>
                    <span className="hint">{item.hint}</span>
                  </button>
                ))}
              </div>
              <div className="action-row">
                <button className="pill" type="button" disabled={acting} onClick={() => void onCashIn()}>
                  {acting ? "Working…" : `Cash in · ${cashInLabel(method)}`}
                </button>
                {confirmCancel ? (
                  <>
                    <button className="pill" type="button" disabled={acting} onClick={() => void onCancel()}>
                      Confirm cancel
                    </button>
                    <button
                      className="pill pill--ghost"
                      type="button"
                      disabled={acting}
                      onClick={() => setConfirmCancel(false)}
                    >
                      Keep quote
                    </button>
                  </>
                ) : (
                  <button
                    className="pill pill--ghost"
                    type="button"
                    disabled={acting}
                    onClick={() => setConfirmCancel(true)}
                  >
                    Cancel quote
                  </button>
                )}
              </div>
            </article>
          ) : null}
        </>
      ) : null}
    </>
  )
}
