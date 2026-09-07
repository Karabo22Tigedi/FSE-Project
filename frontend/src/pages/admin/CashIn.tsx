import { useEffect, useState } from "react"
import { api } from "../../api/client"
import type { Remittance } from "../../api/types"
import { useAuth } from "../../auth/AuthContext"
import { errorDetail, formatRlusd, formatZar, remittanceLabel } from "../app/format"
import { Badge } from "../app/StatusTimeline"
import { formatOptionalDate, methodLabel, staggerStyle } from "../app/walletFormat"

export function CashIn() {
  const { user } = useAuth()
  const [pending, setPending] = useState<Remittance[]>([])
  const [error, setError] = useState("")
  const [ok, setOk] = useState("")
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    const all = await api.allRemittances()
    setPending(all.filter((row) => row.status === "cash_in_pending"))
  }

  useEffect(() => {
    let cancelled = false
    async function run() {
      setError("")
      try {
        const all = await api.allRemittances()
        if (!cancelled) setPending(all.filter((row) => row.status === "cash_in_pending"))
      } catch (err) {
        if (!cancelled) setError(errorDetail(err, "Could not load remittances"))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  async function confirm(id: string) {
    setError("")
    setOk("")
    setBusyId(id)
    try {
      await api.confirmCashIn(id)
      setOk("Cash-in confirmed. Settlement is queued — run the settlement worker next.")
      await load()
    } catch (err) {
      setError(errorDetail(err, "Could not confirm cash-in"))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <h1>Admin cash-in</h1>
      <p className="page-lead">
        {user ? `${user.full_name}. ` : null}
        Confirm simulated ZAR cash-in when funds have been received. This queues settlement.
      </p>
      {error ? <p className="banner banner--error">{error}</p> : null}
      {ok ? <p className="banner banner--ok">{ok}</p> : null}

      {loading ? <p className="muted">Loading remittances…</p> : null}
      {!loading && error && pending.length === 0 ? (
        <article className="app-card stagger-in" style={staggerStyle(0)}>
          <h2>Cash-in queue unavailable</h2>
          <p className="empty-state">Remittances could not be loaded.</p>
        </article>
      ) : null}

      {!loading && pending.length === 0 && !error ? (
        <article className="app-card stagger-in" style={staggerStyle(0)}>
          <h2>Awaiting confirmation</h2>
          <p className="empty-state">No remittances awaiting cash-in confirmation.</p>
        </article>
      ) : (
        <div className="row-list">
          {pending.map((row, index) => (
            <article className="app-card stagger-in" style={staggerStyle(index)} key={row.id}>
              <div className="title-row">
                <h2>
                  <span className="mono">{row.tracking_ref}</span>
                </h2>
                <Badge status={row.status} label={remittanceLabel(row.status)} />
              </div>
              <dl className="kv">
                <dt>Send amount</dt>
                <dd>{formatZar(row.zar_amount)}</dd>
                <dt>UCTUSD</dt>
                <dd>{formatRlusd(row.rlusd_amount)}</dd>
                <dt>Method</dt>
                <dd>{methodLabel(row.cash_in_method)}</dd>
                <dt>Initiated</dt>
                <dd>{formatOptionalDate(row.cash_in_initiated_at)}</dd>
              </dl>
              <div className="action-row">
                <button
                  className="pill"
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => void confirm(row.id)}
                >
                  {busyId === row.id ? "Confirming…" : "Confirm cash-in"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}
