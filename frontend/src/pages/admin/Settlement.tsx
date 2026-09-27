import { useEffect, useState } from "react"
import { api } from "../../api/client"
import type { SettlementMessage } from "../../api/types"
import { useAuth } from "../../auth/useAuth"
import { Modal } from "../../components/Modal"
import { errorDetail } from "../app/format"
import { Badge } from "../app/StatusTimeline"
import {
  canRetrySettlement,
  formatOptionalDate,
  settlementLabel,
  staggerStyle,
} from "../app/walletFormat"

type Confirm = { kind: "run" } | { kind: "retry"; message: SettlementMessage }

type RunResult =
  | { kind: "run"; processed: SettlementMessage[] }
  | { kind: "retry"; message: SettlementMessage }
  | { kind: "error"; title: string; detail: string }

export function Settlement() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<SettlementMessage[]>([])
  const [lastRunCount, setLastRunCount] = useState<number | null>(null)
  const [error, setError] = useState("")
  const [ok, setOk] = useState("")
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [result, setResult] = useState<RunResult | null>(null)

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
      setResult({ kind: "run", processed })
      await loadList()
    } catch (err) {
      const detail = errorDetail(err, "Settlement worker failed")
      setError(detail)
      setResult({ kind: "error", title: "Settlement worker failed", detail })
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
      setResult({ kind: "retry", message: updated })
      await loadList()
    } catch (err) {
      const detail = errorDetail(err, "Could not retry settlement")
      setError(detail)
      setResult({ kind: "error", title: "Could not retry settlement", detail })
    } finally {
      setBusyId(null)
    }
  }

  function onConfirm() {
    const pending = confirm
    setConfirm(null)
    if (pending?.kind === "run") void runWorker()
    else if (pending?.kind === "retry") void retry(pending.message.id)
  }

  const processed = result?.kind === "run" ? result.processed : []
  const completedCount = processed.filter((m) => m.status === "completed").length
  const failedRuns = processed.filter((m) => m.status === "failed")

  return (
    <>
      <h1>Settlement</h1>
      <p className="page-lead">
        {user ? `Signed in as ${user.full_name}. ` : null}
        Run processes one worker pass and shows what it handled. Retry re-queues a stuck message
        — it doesn't settle anything by itself.
      </p>
      {error ? <p className="banner banner--error">{error}</p> : null}
      {ok ? <p className="banner banner--ok">{ok}</p> : null}

      <article className="app-card stagger-in" style={staggerStyle(0)}>
        <h2>Worker</h2>
        <div className="action-row">
          <button
            className="pill"
            type="button"
            disabled={running}
            onClick={() => setConfirm({ kind: "run" })}
          >
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
                    onClick={() => setConfirm({ kind: "retry", message: msg })}
                  >
                    {busyId === msg.id ? "Retrying…" : "Retry"}
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.kind === "retry" ? "Retry this settlement?" : "Run the settlement worker?"}
        actions={
          <>
            <button className="pill" type="button" onClick={onConfirm}>
              {confirm?.kind === "retry" ? "Retry" : "Run worker"}
            </button>
            <button className="pill pill--ghost" type="button" onClick={() => setConfirm(null)}>
              Cancel
            </button>
          </>
        }
      >
        {confirm?.kind === "retry" ? (
          <>
            <p>
              Message <span className="mono">{confirm.message.id}</span> will be reset to pending
              and put back on the queue.
            </p>
            <p className="hint">
              Nothing is paid until you run the worker. If the Payment already went through, the
              worker records it and does not pay again.
            </p>
          </>
        ) : (
          <>
            <p>
              The worker submits a real XRPL Testnet Payment from the platform treasury for every
              queued message.
            </p>
            <p className="hint">
              A recipient's first settlement also creates their Testnet account, so this can take
              up to a minute.
            </p>
          </>
        )}
      </Modal>

      <Modal
        open={result !== null}
        onClose={() => setResult(null)}
        title={
          result?.kind === "error"
            ? result.title
            : result?.kind === "retry"
              ? "Settlement re-queued"
              : processed.length === 0
                ? "Nothing to settle"
                : failedRuns.length === 0
                  ? "Settlement completed"
                  : "Settlement finished with failures"
        }
        actions={
          <>
            {result?.kind === "retry" ? (
              <button
                className="pill"
                type="button"
                onClick={() => {
                  setResult(null)
                  setConfirm({ kind: "run" })
                }}
              >
                Run worker now
              </button>
            ) : null}
            <button
              className={result?.kind === "retry" ? "pill pill--ghost" : "pill"}
              type="button"
              onClick={() => setResult(null)}
            >
              OK
            </button>
          </>
        }
      >
        {result?.kind === "error" ? <p className="banner banner--error">{result.detail}</p> : null}
        {result?.kind === "retry" ? (
          <p>
            The message is {settlementLabel(result.message.status).toLowerCase()} again. Run the
            worker to settle it.
          </p>
        ) : null}
        {result?.kind === "run" ? (
          processed.length === 0 ? (
            <p>There were no queued messages to process.</p>
          ) : (
            <>
              <p>
                Processed {processed.length} message{processed.length === 1 ? "" : "s"}:{" "}
                {completedCount} completed, {failedRuns.length} failed.
              </p>
              {completedCount > 0 ? (
                <p className="hint">
                  The sender's track page and the recipient's wallet now show the transaction hash.
                </p>
              ) : null}
              {failedRuns.map((m) => (
                <p className="banner banner--error" key={m.id}>
                  {m.failure_reason ?? "Settlement failed."}
                </p>
              ))}
            </>
          )
        ) : null}
      </Modal>
    </>
  )
}
