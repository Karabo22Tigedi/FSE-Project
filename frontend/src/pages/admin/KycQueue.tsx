import { useEffect, useState } from "react"
import { api } from "../../api/client"
import type { KycOut } from "../../api/types"
import { useAuth } from "../../auth/AuthContext"
import { errorDetail, formatDateTime, kycLabel } from "../app/format"
import { Badge } from "../app/StatusTimeline"
import { formatOptionalDate, staggerStyle } from "../app/walletFormat"

export function KycQueue() {
  const { user } = useAuth()
  const [pendingOnly, setPendingOnly] = useState(true)
  const [items, setItems] = useState<KycOut[]>([])
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [error, setError] = useState("")
  const [ok, setOk] = useState("")
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError("")
      setLoading(true)
      try {
        const data = await api.listKyc(pendingOnly ? "pending" : undefined)
        if (!cancelled) setItems(data)
      } catch (err) {
        if (!cancelled) setError(errorDetail(err, "Could not load KYC queue"))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [pendingOnly])

  async function reload() {
    const data = await api.listKyc(pendingOnly ? "pending" : undefined)
    setItems(data)
  }

  async function approve(id: string) {
    setError("")
    setOk("")
    setBusyId(id)
    try {
      await api.approveKyc(id)
      setOk("KYC application approved.")
      await reload()
    } catch (err) {
      setError(errorDetail(err, "Could not approve KYC"))
    } finally {
      setBusyId(null)
    }
  }

  async function reject(id: string) {
    const reason = (reasons[id] ?? "").trim()
    if (!reason) {
      setError("A rejection reason is required.")
      return
    }
    setError("")
    setOk("")
    setBusyId(id)
    try {
      await api.rejectKyc(id, reason)
      setOk("KYC application rejected.")
      await reload()
    } catch (err) {
      setError(errorDetail(err, "Could not reject KYC"))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <h1>Admin KYC</h1>
      <p className="page-lead">
        {user ? `${user.full_name}. ` : null}
        Review submitted applications. Approve or reject with a reason.
      </p>
      {error ? <p className="banner banner--error">{error}</p> : null}
      {ok ? <p className="banner banner--ok">{ok}</p> : null}

      <article className="app-card stagger-in" style={staggerStyle(0)}>
        <h2>Queue</h2>
        <label className="filter-check">
          <input
            type="checkbox"
            checked={pendingOnly}
            onChange={(e) => setPendingOnly(e.target.checked)}
          />
          Pending only
        </label>
        {loading ? <p className="muted">Loading KYC applications…</p> : null}
        {!loading && items.length === 0 && error ? (
          <p className="empty-state">The KYC queue could not be loaded.</p>
        ) : null}
        {!loading && items.length === 0 && !error ? (
          <p className="empty-state">
            {pendingOnly ? "No pending KYC applications." : "No KYC applications in this queue."}
          </p>
        ) : null}
      </article>

      {items.map((item, index) => (
        <article className="app-card stagger-in" style={staggerStyle(index + 1)} key={item.id}>
          <div className="title-row">
            <h2>{item.full_name}</h2>
            <Badge status={item.status} label={kycLabel(item.status)} />
          </div>
          <p className="muted">
            Submitted {formatOptionalDate(item.submitted_at)} · {item.email_address} ·{" "}
            {item.mobile_number}
          </p>
          <dl className="kv">
            <dt>Nationality</dt>
            <dd>{item.nationality}</dd>
            <dt>Date of birth</dt>
            <dd>{item.date_of_birth}</dd>
            <dt>ID number</dt>
            <dd>{item.identification_number}</dd>
            <dt>Reviewed</dt>
            <dd>{item.reviewed_at ? formatDateTime(item.reviewed_at) : "—"}</dd>
          </dl>
          <p className="hint">{item.residential_address}</p>
          <p>Source of funds: {item.source_of_funds}</p>
          {item.rejection_reason ? <p className="hint">Reason: {item.rejection_reason}</p> : null}

          {item.status === "pending" ? (
            <form
              className="form-grid"
              onSubmit={(e) => {
                e.preventDefault()
                void reject(item.id)
              }}
            >
              <label>
                Rejection reason
                <textarea
                  rows={2}
                  value={reasons[item.id] ?? ""}
                  onChange={(e) => setReasons((prev) => ({ ...prev, [item.id]: e.target.value }))}
                />
              </label>
              <div className="action-row">
                <button
                  className="pill"
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => void approve(item.id)}
                >
                  Approve
                </button>
                <button className="pill pill--danger" type="submit" disabled={busyId === item.id}>
                  Reject
                </button>
              </div>
            </form>
          ) : null}
        </article>
      ))}
    </>
  )
}
