import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { api } from "../../api/client"
import { ApiError } from "../../api/types"
import type { Beneficiary, KycStatusOut, LimitStatus } from "../../api/types"
import { errorDetail, formatZar } from "./format"
import { staggerStyle } from "./StatusTimeline"

export function Send() {
  const navigate = useNavigate()
  const [kyc, setKyc] = useState<KycStatusOut | null>(null)
  const [people, setPeople] = useState<Beneficiary[]>([])
  const [limits, setLimits] = useState<LimitStatus | null>(null)
  const [beneficiaryId, setBeneficiaryId] = useState("")
  const [zarAmount, setZarAmount] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError("")
      try {
        const status = await api.kycStatus()
        if (cancelled) return
        setKyc(status)
        if (status.status !== "approved") {
          return
        }
        const [list, remaining] = await Promise.all([api.beneficiaries(), api.limits()])
        if (cancelled) return
        setPeople(list)
        setLimits(remaining)
        if (list[0]) setBeneficiaryId(list[0].id)
      } catch (err) {
        if (!cancelled) setError(errorDetail(err, "Could not load the quote form"))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const approved = kyc?.status === "approved"

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")
    setSaving(true)
    try {
      const quote = await api.createQuote(beneficiaryId, zarAmount)
      navigate(`/app/send/${quote.id}`)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 422 || err.status === 403)) {
        setError(err.detail)
      } else {
        setError(errorDetail(err, "Could not lock a quote"))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <h1>New quote</h1>
      <p className="page-lead">
        Lock a 15-minute rate and fee breakdown for a ZAR send. Cash-in happens on the next screen.
      </p>
      {loading ? <p className="muted">Loading…</p> : null}
      {error ? <p className="banner banner--error">{error}</p> : null}

      {kyc && !approved ? (
        <article className="app-card stagger-in" style={staggerStyle(0)}>
          <h2>KYC not approved</h2>
          <p>
            You cannot lock a quote until an administrator approves your KYC.
            {kyc.status === "pending" ? " Your application is still under review." : null}
            {kyc.status === "rejected" ? " Resubmit your application after the rejection." : null}
            {kyc.status === "not_submitted" ? " Submit your details first." : null}
          </p>
          <div className="action-row">
            <Link className="pill" to="/app/kyc">
              Go to KYC
            </Link>
          </div>
        </article>
      ) : null}

      {approved && people.length === 0 && !loading && !error ? (
        <article className="app-card stagger-in" style={staggerStyle(0)}>
          <h2>No beneficiaries</h2>
          <p className="empty-state">Add someone to send to before you can lock a quote.</p>
          <div className="action-row">
            <Link className="pill" to="/app/beneficiaries">
              Add a beneficiary
            </Link>
          </div>
        </article>
      ) : null}

      {approved && people.length > 0 ? (
        <article className="app-card stagger-in" style={staggerStyle(0)}>
          <h2>Lock a quote</h2>
          {limits ? (
            <p className="hint">
              Remaining today {formatZar(limits.remaining_today_zar)} · this month{" "}
              {formatZar(limits.remaining_this_month_zar)}
            </p>
          ) : null}
          <form className="form-grid" onSubmit={(e) => void onSubmit(e)}>
            <label>
              Beneficiary
              <select
                value={beneficiaryId}
                onChange={(e) => setBeneficiaryId(e.target.value)}
                required
              >
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.full_name} · {person.country} · {person.payout_currency}
                    {person.linked_user_id ? " · linked" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              ZAR amount
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={zarAmount}
                onChange={(e) => setZarAmount(e.target.value)}
                required
              />
            </label>
            <button className="pill" type="submit" disabled={saving || !beneficiaryId}>
              {saving ? "Locking…" : "Lock quote"}
            </button>
          </form>
        </article>
      ) : null}
    </>
  )
}
