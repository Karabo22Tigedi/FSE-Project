import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { api } from "../../api/client"
import type { Beneficiary, Remittance } from "../../api/types"
import { errorDetail, formatDateTime, formatZar, isExpired } from "./format"
import { RemittanceBadge } from "./StatusTimeline"
import { staggerStyle } from "./walletFormat"

export function History() {
  const [rows, setRows] = useState<Remittance[]>([])
  const [people, setPeople] = useState<Beneficiary[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError("")
      try {
        const [list, beneficiaries] = await Promise.all([
          api.myRemittances(),
          api.beneficiaries().catch(() => [] as Beneficiary[]),
        ])
        if (cancelled) return
        setRows(list)
        setPeople(beneficiaries)
      } catch (err) {
        if (!cancelled) setError(errorDetail(err, "Could not load history"))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const names = useMemo(() => {
    const map = new Map<string, string>()
    for (const person of people) map.set(person.id, person.full_name)
    return map
  }, [people])

  return (
    <>
      <h1>History</h1>
      <p className="page-lead">Quotes you have locked, cashed in, settled, or cancelled.</p>
      {loading ? <p className="muted">Loading history…</p> : null}
      {error ? <p className="banner banner--error">{error}</p> : null}

      {!loading && rows.length === 0 && !error ? (
        <article className="app-card stagger-in" style={staggerStyle(0)}>
          <h2>Nothing sent yet</h2>
          <p className="empty-state">When you lock a quote it will show up here.</p>
          <div className="action-row">
            <Link className="pill" to="/app/send">
              New quote
            </Link>
          </div>
        </article>
      ) : null}

      {rows.length > 0 ? (
        <div className="row-list">
          {rows.map((row, index) => {
            const expired = row.status === "quoted" && isExpired(row.expires_at)
            return (
              <article
                key={row.id}
                className="app-card stagger-in"
                style={staggerStyle(Math.min(index, 8))}
              >
                <div className="title-row">
                  <h2>{formatZar(row.zar_amount)}</h2>
                  <RemittanceBadge status={row.status} expired={expired} />
                </div>
                <p className="muted">
                  {names.get(row.beneficiary_id) ?? "Beneficiary"} ·{" "}
                  <span className="mono">{row.tracking_ref}</span>
                </p>
                <p className="hint">{formatDateTime(row.created_at)}</p>
                <div className="action-row">
                  <Link className="pill" to={`/app/send/${row.id}`}>
                    Quote
                  </Link>
                  <Link className="pill pill--ghost" to={`/app/track/${row.tracking_ref}`}>
                    Track
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      ) : null}
    </>
  )
}
