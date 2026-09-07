import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { api } from "../../api/client"
import { ApiError } from "../../api/types"
import type { Remittance } from "../../api/types"
import { errorDetail, formatDateTime, isExpired } from "./format"
import { QuoteBreakdown, RemittanceBadge, StatusTimeline, TxHash } from "./StatusTimeline"
import { staggerStyle } from "./walletFormat"

export function Track() {
  const { ref } = useParams<{ ref: string }>()
  const [remittance, setRemittance] = useState<Remittance | null>(null)
  const [error, setError] = useState("")
  const [forbidden, setForbidden] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError("")
      setForbidden(false)
      setNotFound(false)
      setRemittance(null)
      if (!ref) {
        setNotFound(true)
        setLoading(false)
        return
      }
      try {
        const found = await api.track(ref)
        if (cancelled) return
        setRemittance(found)
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 403) {
          setForbidden(true)
          setError(err.detail)
        } else if (err instanceof ApiError && err.status === 404) {
          setNotFound(true)
          setError(err.detail)
        } else {
          setError(errorDetail(err, "Could not track this remittance"))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [ref])

  const expiredQuoted =
    remittance?.status === "quoted" && isExpired(remittance.expires_at)

  return (
    <>
      <h1>Track</h1>
      <p className="page-lead">
        {ref ? (
          <>
            Tracking <span className="mono">{ref}</span>
          </>
        ) : (
          "Look up a remittance by tracking reference."
        )}
      </p>
      {loading ? <p className="muted">Looking up this transfer…</p> : null}
      {error && !forbidden && !notFound ? <p className="banner banner--error">{error}</p> : null}

      {forbidden ? (
        <article className="app-card stagger-in" style={staggerStyle(0)}>
          <h2>Not allowed</h2>
          <p>
            You can only track remittances you sent, received as a linked beneficiary, or as an
            administrator.
          </p>
          <p className="banner banner--error">{error}</p>
          <div className="action-row">
            <Link className="pill" to="/app/history">
              Back to history
            </Link>
          </div>
        </article>
      ) : null}

      {notFound ? (
        <article className="app-card stagger-in" style={staggerStyle(0)}>
          <h2>Not found</h2>
          <p className="empty-state">No remittance matches that tracking reference.</p>
          {error ? <p className="banner banner--error">{error}</p> : null}
          <div className="action-row">
            <Link className="pill" to="/app/history">
              History
            </Link>
          </div>
        </article>
      ) : null}

      {remittance ? (
        <>
          <article className="app-card stagger-in" style={staggerStyle(0)}>
            <div className="title-row">
              <h2>Status</h2>
              <RemittanceBadge status={remittance.status} expired={expiredQuoted} />
            </div>
            {remittance.status === "cancelled" ? (
              <p className="banner banner--warn">This quote was cancelled.</p>
            ) : null}
            {expiredQuoted ? (
              <p className="banner banner--error">
                Quote expired at {formatDateTime(remittance.expires_at)}.
              </p>
            ) : null}
            {remittance.status === "settlement_failed" ? (
              <p className="banner banner--error">
                {remittance.settlement_failure_reason ?? "Settlement failed."}
              </p>
            ) : null}
            <StatusTimeline status={remittance.status} expired={expiredQuoted} />
            {remittance.status === "settled" ? (
              <TxHash hash={remittance.xrpl_settlement_tx_hash} />
            ) : null}
          </article>

          <article className="app-card stagger-in" style={staggerStyle(1)}>
            <h2>Quote snapshot</h2>
            <QuoteBreakdown remittance={remittance} />
            <div className="action-row">
              <Link className="pill" to={`/app/send/${remittance.id}`}>
                Open quote
              </Link>
              <Link className="pill pill--ghost" to="/app/history">
                History
              </Link>
            </div>
          </article>
        </>
      ) : null}
    </>
  )
}
