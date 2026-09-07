import { useEffect, useState } from "react"
import { api } from "../../api/client"
import type { SettlementMessage } from "../../api/types"
import { useAuth } from "../../auth/useAuth"
import { errorDetail } from "../app/format"
import { Badge } from "../app/StatusTimeline"
import {
  canRetrySettlement,
  formatOptionalDate,
  settlementLabel,
  staggerStyle,
} from "../app/walletFormat"

export function Settlement() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<SettlementMessage[]>([])
  const [lastRunCount, setLastRunCount] = useState<number | null>(null)
  const [error, setError] = useState("")
  const [ok, setOk] = useState("")
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function loadList() {
    const data = await api.settlement()
    setMessages(data)
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError("")
      try {
        const data = await api.settlement()
        if (!cancelled) setMessages(data)
      } catch (err) {
        if (!cancelled) setError(errorDetail(err, "Could not load settlement queue"))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function runWorker() {
    setError("")
    setOk("")
    setRunning(true)
    try {
      const processed = await api.runSettlement()
      setLastRunCount(processed.length)
      if (processed.length === 0) {
        setOk("Worker finished this pass with no messages to process.")
      } else {
        const done = processed.filter((m) => m.status === "completed").length
        const failed = processed.filter((m) => m.status === "failed").length
        setOk(
          `Worker finished ${processed.length} message(s): ${done} completed, ${failed} failed.`,
        )
      }
      await loadList()
    } catch (err) {
      setError(errorDetail(err, "Settlement worker failed"))
    } finally {
      setRunning(false)
    }
  }

  async function retry(id: string) {
    setError("")
    setOk("")
    setBusyId(id)
    try {
      const updated = await api.retrySettlement(id)
      setOk(
        `Re-queued as ${settlementLabel(updated.status)}. Run the worker to process it — retry does not settle by itself.`,
      )
      await loadList()
    } catch (err) {
      setError(errorDetail(err, "Could not retry settlement"))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <h1>Settlement</h1>
      <p className="page-lead">
        {user ? `${user.full_name}. ` : null}
        Run waits for one worker pass and returns what it handled. Retry re-queues a pending,
        processing, or failed message; it does not complete settlement on its own.
      </p>
      {error ? <p className="banner banner--error">{error}</p> : null}
      {ok ? <p className="banner banner--ok">{ok}</p> : null}

      <article className="app-card stagger-in" style={staggerStyle(0)}>
        <h2>Worker</h2>
        <div className="action-row">
          <button className="pill" type="button" disabled={running} onClick={() => void runWorker()}>
            {running ? "Running worker…" : "Run settlement worker"}
          </button>
        </div>
        {lastRunCount != null ? (
          <p className="hint">
            Last pass processed {lastRunCount} message{lastRunCount === 1 ? "" : "s"}.
          </p>
        ) : null}
      </article>

      {loading ? <p className="muted">Loading settlement messages…</p> : null}
      {!loading && error && messages.length === 0 ? (
        <article className="app-card stagger-in" style={staggerStyle(1)}>
          <h2>Messages unavailable</h2>
          <p className="empty-state">The settlement queue could not be loaded.</p>
        </article>
      ) : null}

      {!loading && messages.length === 0 && !error ? (
        <article className="app-card stagger-in" style={staggerStyle(1)}>
          <h2>Messages</h2>
          <p className="empty-state">
            No settlement messages yet. Confirm a cash-in, then run the worker.
          </p>
        </article>
      ) : (
        <div className="row-list">
          {messages.map((msg, index) => (
            <article className="app-card stagger-in" style={staggerStyle(index + 1)} key={msg.id}>
              <div className="title-row">
                <h2 className="mono">{msg.id}</h2>
                <Badge status={msg.status} label={settlementLabel(msg.status)} />
              </div>
              <dl className="kv">
                <dt>Attempts</dt>
                <dd>{msg.attempts}</dd>
                <dt>stream_entry_id</dt>
                <dd className="mono">{msg.stream_entry_id ?? "—"}</dd>
                <dt>Remittance</dt>
                <dd className="mono">{msg.remittance_id}</dd>
                <dt>Created</dt>
                <dd>{formatOptionalDate(msg.created_at)}</dd>
                <dt>Processed</dt>
                <dd>{formatOptionalDate(msg.processed_at)}</dd>
              </dl>
              {msg.failure_reason ? (
                <p className="banner banner--error">{msg.failure_reason}</p>
              ) : null}
              {canRetrySettlement(msg.status) ? (
                <div className="action-row">
                  <button
                    className="pill pill--ghost"
                    type="button"
                    disabled={busyId === msg.id || running}
                    onClick={() => void retry(msg.id)}
                  >
                    {busyId === msg.id ? "Retrying…" : "Retry"}
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </>
  )
}
