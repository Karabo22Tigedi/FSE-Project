import { useEffect, useState } from "react"
import { api } from "../../api/client"
import type { CashOut } from "../../api/types"
import { useAuth } from "../../auth/AuthContext"
import { errorDetail, formatRlusd } from "../app/format"
import { Badge } from "../app/StatusTimeline"
import {
  cashOutActions,
  cashOutLabel,
  formatFiat,
  formatOptionalDate,
  staggerStyle,
} from "../app/walletFormat"

export function CashOutQueue() {
  const { user } = useAuth()
  const [items, setItems] = useState<CashOut[]>([])
  const [error, setError] = useState("")
  const [ok, setOk] = useState("")
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    const data = await api.allCashOuts()
    setItems(data)
  }

  useEffect(() => {
    let cancelled = false
    async function run() {
      setError("")
      try {
        const data = await api.allCashOuts()
        if (!cancelled) setItems(data)
      } catch (err) {
        if (!cancelled) setError(errorDetail(err, "Could not load cash-outs"))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  async function act(id: string, kind: "approve" | "complete" | "fail") {
    setError("")
    setOk("")
    setBusyId(id)
    try {
      if (kind === "approve") await api.approveCashOut(id)
      else if (kind === "complete") await api.completeCashOut(id)
      else await api.failCashOut(id)
      setOk(
        kind === "fail"
          ? "Cash-out failed. Reserved UCTUSD was refunded to the recipient's spendable balance."
          : kind === "approve"
            ? "Cash-out approved."
            : "Cash-out completed. Reserved UCTUSD was burned by paying the issuer.",
      )
      await load()
    } catch (err) {
      setError(errorDetail(err, "Could not update cash-out"))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <h1>Admin cash-outs</h1>
      <p className="page-lead">
        {user ? `${user.full_name}. ` : null}
        requested → approve or fail. approved → complete or fail. Complete burns UCTUSD by
        paying the issuer. Fail still refunds spendable UCTUSD.
      </p>
      {error ? <p className="banner banner--error">{error}</p> : null}
      {ok ? <p className="banner banner--ok">{ok}</p> : null}
      {loading ? <p className="muted">Loading cash-outs…</p> : null}
      {!loading && error && items.length === 0 ? (
        <article className="app-card stagger-in" style={staggerStyle(0)}>
          <h2>Cash-out queue unavailable</h2>
          <p className="empty-state">Cash-out requests could not be loaded.</p>
        </article>
      ) : null}

      {!loading && items.length === 0 && !error ? (
        <article className="app-card stagger-in" style={staggerStyle(0)}>
          <h2>Requests</h2>
          <p className="empty-state">No cash-out requests.</p>
        </article>
      ) : (
        <div className="row-list">
          {items.map((item, index) => {
            const actions = cashOutActions(item.status)
            const burnHash =
              "xrpl_burn_tx_hash" in item
                ? (item as { xrpl_burn_tx_hash?: string | null }).xrpl_burn_tx_hash ?? null
                : null
            return (
              <article className="app-card stagger-in" style={staggerStyle(index)} key={item.id}>
                <div className="title-row">
                  <h2>{formatRlusd(item.rlusd_amount)}</h2>
                  <Badge status={item.status} label={cashOutLabel(item.status)} />
                </div>
                <p className="muted">User {item.user_id}</p>
                <dl className="kv">
                  <dt>Fee</dt>
                  <dd>{formatRlusd(item.fee_amount_rlusd)}</dd>
                  <dt>Payout</dt>
                  <dd>{formatFiat(item.fiat_payout_amount, item.fiat_currency)}</dd>
                  <dt>Created</dt>
                  <dd>{formatOptionalDate(item.created_at)}</dd>
                </dl>
                {burnHash ? <p className="mono hint">{burnHash}</p> : null}
                {actions.approve || actions.complete || actions.fail ? (
                  <div className="action-row">
                    {actions.approve ? (
                      <button
                        className="pill"
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => void act(item.id, "approve")}
                      >
                        Approve
                      </button>
                    ) : null}
                    {actions.complete ? (
                      <button
                        className="pill"
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => void act(item.id, "complete")}
                      >
                        Complete
                      </button>
                    ) : null}
                    {actions.fail ? (
                      <button
                        className="pill pill--danger"
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => void act(item.id, "fail")}
                      >
                        Fail
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}
