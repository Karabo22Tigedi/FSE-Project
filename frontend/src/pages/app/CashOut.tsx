import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { Link } from "react-router-dom"
import { api } from "../../api/client"
import type { CashOut as CashOutRecord, KycStatusOut } from "../../api/types"
import { useAuth } from "../../auth/useAuth"
import { errorDetail, formatPct, formatRate, formatRlusd, kycLabel } from "./format"
import { Badge } from "./StatusTimeline"
import { cashOutLabel, formatFiat, formatOptionalDate, staggerStyle } from "./walletFormat"

export function CashOut() {
  const { user } = useAuth()
  const [kyc, setKyc] = useState<KycStatusOut | null>(null)
  const [items, setItems] = useState<CashOutRecord[]>([])
  const [latest, setLatest] = useState<CashOutRecord | null>(null)
  const [spendable, setSpendable] = useState<string | null>(null)
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState<"USD" | "ZAR">("USD")
  const [error, setError] = useState("")
  const [ok, setOk] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const approved = kyc?.status === "approved"

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError("")
      try {
        const [status, cashOuts] = await Promise.all([api.kycStatus(), api.myCashOuts()])
        if (cancelled) return
        setKyc(status)
        setItems(cashOuts)
        if (status.status === "approved") {
          try {
            const wallet = await api.wallet()
            if (!cancelled) setSpendable(wallet.spendable_balance)
          } catch {
            if (!cancelled) setSpendable(null)
          }
        }
      } catch (err) {
        if (!cancelled) setError(errorDetail(err, "Could not load cash-out data"))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")
    setOk("")
    setSubmitting(true)
    try {
      const created = await api.createCashOut(amount, currency)
      setLatest(created)
      setOk("Cash-out requested. Spendable UCTUSD is reserved until it is completed or failed.")
      setAmount("")
      const list = await api.myCashOuts()
      setItems(list)
      const wallet = await api.wallet()
      setSpendable(wallet.spendable_balance)
    } catch (err) {
      setError(errorDetail(err, "Could not request cash-out"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <h1>Cash-out</h1>
      <p className="page-lead">
        {user ? `${user.full_name}. ` : null}
        Status flow: requested → approved → completed. A failed cash-out refunds the reserved
        amount to your spendable balance.
      </p>
      {error ? <p className="banner banner--error">{error}</p> : null}
      {ok ? <p className="banner banner--ok">{ok}</p> : null}
      {loading ? <p className="muted">Loading cash-out…</p> : null}

      <article className="app-card stagger-in" style={staggerStyle(0)}>
        <div className="title-row">
          <h2>Request payout</h2>
          {kyc ? <Badge status={kyc.status} label={kycLabel(kyc.status)} /> : null}
        </div>
        {loading ? <p className="muted">Checking whether KYC is approved…</p> : null}
        {!loading && !kyc && error ? (
          <p className="empty-state">We could not check KYC, so cash-out is unavailable.</p>
        ) : null}
        {kyc && !approved ? (
          <>
            <p>
              You can hold UCTUSD without KYC, but you cannot request a cash-out until KYC is
              approved.
            </p>
            {kyc.rejection_reason ? (
              <p className="banner banner--error">{kyc.rejection_reason}</p>
            ) : null}
            <div className="action-row">
              <Link className="pill" to="/app/kyc">
                Go to KYC
              </Link>
            </div>
          </>
        ) : null}
        {approved ? (
          <>
            {spendable != null ? (
              <p className="hint">Spendable balance {formatRlusd(spendable)}</p>
            ) : null}
            <form className="form-grid" onSubmit={(ev) => void onSubmit(ev)}>
              <label>
                UCTUSD amount
                <input
                  name="rlusd_amount"
                  type="number"
                  inputMode="decimal"
                  min="0.000001"
                  step="0.000001"
                  value={amount}
                  onChange={(ev) => setAmount(ev.target.value)}
                  required
                />
              </label>
              <label>
                Fiat currency
                <select
                  name="fiat_currency"
                  value={currency}
                  onChange={(ev) => setCurrency(ev.target.value === "ZAR" ? "ZAR" : "USD")}
                >
                  <option value="USD">USD</option>
                  <option value="ZAR">ZAR</option>
                </select>
              </label>
              <button className="pill" type="submit" disabled={submitting}>
                {submitting ? "Requesting…" : "Request cash-out"}
              </button>
            </form>
          </>
        ) : null}
      </article>

      {latest ? (
        <article className="app-card stagger-in" style={staggerStyle(1)}>
          <div className="title-row">
            <h2>Latest request</h2>
            <Badge status={latest.status} label={cashOutLabel(latest.status)} />
          </div>
          <dl className="kv">
            <dt>Amount</dt>
            <dd>{formatRlusd(latest.rlusd_amount)}</dd>
            <dt>fee_amount_rlusd</dt>
            <dd>{formatRlusd(latest.fee_amount_rlusd)}</dd>
            <dt>fiat_payout_amount</dt>
            <dd>{formatFiat(latest.fiat_payout_amount, latest.fiat_currency)}</dd>
            <dt>Status</dt>
            <dd>{cashOutLabel(latest.status)}</dd>
          </dl>
          <p className="hint">
            Fee {formatPct(latest.cash_out_fee_percentage)} · rate {formatRate(latest.exchange_rate)}
          </p>
          <p className="mono hint">Hash {latest.xrpl_burn_tx_hash ?? "—"}</p>
        </article>
      ) : null}

      <article className="app-card stagger-in" style={staggerStyle(latest ? 2 : 1)}>
        <h2>Your cash-outs</h2>
        {items.length === 0 ? (
          kyc ? <p className="empty-state">No cash-out requests yet.</p> : null
        ) : (
          <div className="row-list">
            {items.map((item) => (
              <div className="metric" key={item.id}>
                <div className="title-row">
                  <strong>{formatRlusd(item.rlusd_amount)}</strong>
                  <Badge status={item.status} label={cashOutLabel(item.status)} />
                </div>
                <p className="hint">
                  Fee {formatRlusd(item.fee_amount_rlusd)} · Payout{" "}
                  {formatFiat(item.fiat_payout_amount, item.fiat_currency)}
                </p>
                <p className="hint">{formatOptionalDate(item.created_at)}</p>
                <p className="mono hint">Hash {item.xrpl_burn_tx_hash ?? "—"}</p>
                {item.status === "failed" ? (
                  <p className="hint">Failed — reserved UCTUSD was refunded to spendable.</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </article>
    </>
  )
}
