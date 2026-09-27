import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { api } from "../../api/client"
import type { KycStatusOut, LimitStatus, User } from "../../api/types"
import { useAuth } from "../../auth/useAuth"
import { errorDetail, formatZar, kycLabel } from "./format"
import { Badge } from "./StatusTimeline"
import { staggerStyle } from "./walletFormat"

function LimitBar({ used, limit, label }: { used: string; limit: string; label: string }) {
  const usedN = Number(used)
  const limitN = Number(limit)
  const pct = limitN > 0 ? Math.min(100, (usedN / limitN) * 100) : 0
  const level = limitN > 0 && pct >= 100 ? "full" : pct >= 80 ? "high" : "ok"
  return (
    <div
      className="limit-bar"
      role="progressbar"
      aria-label={`${label} limit used`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-valuetext={`${formatZar(used)} of ${formatZar(limit)} used`}
    >
      <div className={`limit-bar__fill limit-bar__fill--${level}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function usedPercent(used: string, limit: string): string {
  const limitN = Number(limit)
  if (!(limitN > 0)) return ""
  return ` (${Math.round(Math.min(100, (Number(used) / limitN) * 100))}%)`
}

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
      <p className="page-lead">Your account, KYC status, and how much you can still send this month.</p>
      {error ? <p className="banner banner--error">{error}</p> : null}
      {loading ? <p className="muted">Loading your account…</p> : null}

      {me ? (
        <article className="app-card stagger-in" style={staggerStyle(0)}>
          <div className="title-row">
            <h2>{me.full_name}</h2>
            {kyc ? <Badge status={kyc.status} label={kycLabel(kyc.status)} /> : null}
          </div>
          <p className="muted">{me.email}</p>
          <div className="action-row">
            <Link className="pill pill--ghost" to="/app/profile">
              Edit profile
            </Link>
          </div>
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
              <div className="metric__label">Left today</div>
              <div className="metric__value">{formatZar(limits.remaining_today_zar)}</div>
              <LimitBar used={limits.used_today_zar} limit={limits.daily_limit_zar} label="Daily" />
              <p className="hint">
                {formatZar(limits.used_today_zar)} of {formatZar(limits.daily_limit_zar)} used
                {usedPercent(limits.used_today_zar, limits.daily_limit_zar)}
              </p>
            </div>
            <div className="metric">
              <div className="metric__label">Left this month</div>
              <div className="metric__value">{formatZar(limits.remaining_this_month_zar)}</div>
              <LimitBar
                used={limits.used_this_month_zar}
                limit={limits.monthly_limit_zar}
                label="Monthly"
              />
              <p className="hint">
                {formatZar(limits.used_this_month_zar)} of {formatZar(limits.monthly_limit_zar)} used
                {usedPercent(limits.used_this_month_zar, limits.monthly_limit_zar)}
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
              Please complete KYC first — an administrator needs to approve it before any ZAR
              leaves the platform.
            </p>
          ) : null}
          {kyc.status === "pending" ? (
            <p>
              Your KYC is waiting on an administrator. You'll be able to send and add
              beneficiaries once it's approved.
            </p>
          ) : null}
          {kyc.status === "rejected" ? (
            <p>Your KYC wasn't approved. Update your details and resubmit for another review.</p>
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
