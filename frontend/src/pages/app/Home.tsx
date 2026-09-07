import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { api } from "../../api/client"
import type { KycStatusOut, LimitStatus, User } from "../../api/types"
import { useAuth } from "../../auth/AuthContext"
import { errorDetail, formatZar, kycLabel } from "./format"
import { Badge, staggerStyle } from "./StatusTimeline"

export function Home() {
  const { user: sessionUser } = useAuth()
  const [me, setMe] = useState<User | null>(sessionUser)
  const [kyc, setKyc] = useState<KycStatusOut | null>(null)
  const [limits, setLimits] = useState<LimitStatus | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError("")
      try {
        const [user, status, remaining] = await Promise.all([
          api.me(),
          api.kycStatus(),
          api.limits(),
        ])
        if (cancelled) return
        setMe(user)
        setKyc(status)
        setLimits(remaining)
      } catch (err) {
        if (!cancelled) setError(errorDetail(err, "Could not load your account"))
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

  return (
    <>
      <h1>Home</h1>
      <p className="page-lead">Your sending account, KYC status, and remaining ZAR limits.</p>
      {error ? <p className="banner banner--error">{error}</p> : null}
      {loading ? <p className="muted">Loading your account…</p> : null}

      {me ? (
        <article className="app-card stagger-in" style={staggerStyle(0)}>
          <div className="title-row">
            <h2>{me.full_name}</h2>
            {kyc ? <Badge status={kyc.status} label={kycLabel(kyc.status)} /> : null}
          </div>
          <p className="muted">{me.email}</p>
          {kyc?.status === "rejected" && kyc.rejection_reason ? (
            <p className="banner banner--error">{kyc.rejection_reason}</p>
          ) : null}
        </article>
      ) : null}

      {limits ? (
        <article className="app-card stagger-in" style={staggerStyle(1)}>
          <h2>Remaining limits</h2>
          <p className="hint">Tier {limits.tier}</p>
          <div className="metric-row">
            <div className="metric">
              <div className="metric__label">Today</div>
              <div className="metric__value">{formatZar(limits.remaining_today_zar)}</div>
              <p className="hint">
                {formatZar(limits.used_today_zar)} of {formatZar(limits.daily_limit_zar)} used
              </p>
            </div>
            <div className="metric">
              <div className="metric__label">This month</div>
              <div className="metric__value">{formatZar(limits.remaining_this_month_zar)}</div>
              <p className="hint">
                {formatZar(limits.used_this_month_zar)} of {formatZar(limits.monthly_limit_zar)} used
              </p>
            </div>
          </div>
        </article>
      ) : null}

      {kyc && !approved ? (
        <article className="app-card stagger-in" style={staggerStyle(2)}>
          <h2>Sending is locked</h2>
          {kyc.status === "not_submitted" ? (
            <p>
              Complete KYC before you can lock a quote. An administrator must approve it before any
              ZAR leaves the platform.
            </p>
          ) : null}
          {kyc.status === "pending" ? (
            <p>
              Your KYC is with an administrator. You must wait for approval before you can send or
              add beneficiaries.
            </p>
          ) : null}
          {kyc.status === "rejected" ? (
            <p>
              This KYC was not approved. Update your details and resubmit so an administrator can
              review it again.
            </p>
          ) : null}
          <div className="action-row">
            <Link className="pill" to="/app/kyc">
              {kyc.status === "rejected" ? "Resubmit KYC" : "Go to KYC"}
            </Link>
          </div>
        </article>
      ) : null}

      {approved ? (
        <article className="app-card stagger-in" style={staggerStyle(2)}>
          <h2>Ready to send</h2>
          <p className="muted">KYC is approved. Lock a quote or manage who you send to.</p>
          <div className="action-row">
            <Link className="pill" to="/app/send">
              New quote
            </Link>
            <Link className="pill pill--ghost" to="/app/beneficiaries">
              Beneficiaries
            </Link>
          </div>
        </article>
      ) : null}
    </>
  )
}
