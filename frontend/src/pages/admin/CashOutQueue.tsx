import { useEffect, useState } from "react"
import { api } from "../../api/client"
import type { CashOut } from "../../api/types"
import { useAuth } from "../../auth/useAuth"
import { Modal } from "../../components/Modal"
import { errorDetail, formatRlusd } from "../app/format"
import { Badge } from "../app/StatusTimeline"
import {
  cashOutActions,
  cashOutLabel,
  formatFiat,
  formatOptionalDate,
  staggerStyle,
} from "../app/walletFormat"

type Action = "approve" | "complete" | "fail"

type Result =
  | { kind: Action; item: CashOut }
  | { kind: "error"; detail: string }

const CONFIRM_TITLE: Record<Action, string> = {
  approve: "Approve this cash-out?",
  complete: "Complete this cash-out?",
  fail: "Fail this cash-out?",
}

const RESULT_TITLE: Record<Action, string> = {
  approve: "Cash-out approved",
  complete: "Cash-out completed",
  fail: "Cash-out failed",
}

export function CashOutQueue() {
  const { user } = useAuth()
  const [items, setItems] = useState<CashOut[]>([])
  const [error, setError] = useState("")
  const [ok, setOk] = useState("")
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ kind: Action; item: CashOut } | null>(null)
  const [result, setResult] = useState<Result | null>(null)

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

  async function act(id: string, kind: Action) {
    setError("")
    setOk("")
    setBusyId(id)
    try {
      let updated: CashOut
      if (kind === "approve") updated = await api.approveCashOut(id)
      else if (kind === "complete") updated = await api.completeCashOut(id)
      else updated = await api.failCashOut(id)
      setOk(
        kind === "fail"
          ? "Cash-out failed. Reserved UCTUSD was refunded to the recipient's spendable balance."
          : kind === "approve"
            ? "Cash-out approved."
            : "Cash-out completed. Reserved UCTUSD was burned by paying the issuer.",
      )
      setResult({ kind, item: updated })
      await load()
    } catch (err) {
      const detail = errorDetail(err, "Could not update cash-out")
      setError(detail)
      setResult({ kind: "error", detail })
    } finally {
      setBusyId(null)
    }
  }

  function onConfirm() {
    const pending = confirm
    setConfirm(null)
    if (pending) void act(pending.item.id, pending.kind)
  }

  const summary = (item: CashOut) =>
    `${formatRlusd(item.rlusd_amount)} → ${formatFiat(item.fiat_payout_amount, item.fiat_currency)}`

  return (
    <>
      <h1>Admin cash-outs</h1>
      <p className="page-lead">
        {user ? `Signed in as ${user.full_name}. ` : null}
        Approve or fail a requested cash-out, then complete or fail it once it's approved.
        Completing burns UCTUSD by paying the issuer — failing refunds the cash-out user's spendable
        balance.
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
            const burnHash = item.xrpl_burn_tx_hash ?? null
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
                        onClick={() => setConfirm({ kind: "approve", item })}
                      >
                        Approve
                      </button>
                    ) : null}
                    {actions.complete ? (
                      <button
                        className="pill"
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => setConfirm({ kind: "complete", item })}
                      >
                        {busyId === item.id ? "Completing…" : "Complete"}
                      </button>
                    ) : null}
                    {actions.fail ? (
                      <button
                        className="pill pill--danger"
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => setConfirm({ kind: "fail", item })}
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

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm ? CONFIRM_TITLE[confirm.kind] : ""}
        actions={
          <>
            <button
              className={confirm?.kind === "fail" ? "pill pill--danger" : "pill"}
              type="button"
              onClick={onConfirm}
            >
              {confirm?.kind === "approve"
                ? "Approve"
                : confirm?.kind === "complete"
                  ? "Complete and burn"
                  : "Fail and refund"}
            </button>
            <button className="pill pill--ghost" type="button" onClick={() => setConfirm(null)}>
              Cancel
            </button>
          </>
        }
      >
        {confirm ? <p className="mono">{summary(confirm.item)}</p> : null}
        {confirm?.kind === "approve" ? (
          <p className="hint">
            After approval you can complete it, which burns the UCTUSD, or fail it, which refunds
            it.
          </p>
        ) : null}
        {confirm?.kind === "complete" ? (
          <p className="hint">
            This pays {formatRlusd(confirm.item.rlusd_amount)} from the recipient's custodial
            account to the UCTUSD issuer on XRPL Testnet, burning it. It cannot be undone. The fiat
            payout itself is simulated.
          </p>
        ) : null}
        {confirm?.kind === "fail" ? (
          <p className="hint">
            {formatRlusd(confirm.item.rlusd_amount)} goes back to the recipient's spendable balance
            and no fiat is paid out.
          </p>
        ) : null}
      </Modal>

      <Modal
        open={result !== null}
        onClose={() => setResult(null)}
        title={
          result?.kind === "error"
            ? "Could not update cash-out"
            : result
              ? RESULT_TITLE[result.kind]
              : ""
        }
        actions={
          <button className="pill" type="button" onClick={() => setResult(null)}>
            OK
          </button>
        }
      >
        {result?.kind === "error" ? <p className="banner banner--error">{result.detail}</p> : null}
        {result && result.kind !== "error" ? (
          <p className="mono">{summary(result.item)}</p>
        ) : null}
        {result?.kind === "approve" ? (
          <p className="hint">Complete it to burn the UCTUSD, or fail it to refund it.</p>
        ) : null}
        {result?.kind === "complete" ? (
          <>
            <p className="hint">The reserved UCTUSD was burned by paying the issuer.</p>
            {result.item.xrpl_burn_tx_hash ? (
              <p className="mono">
                Burn hash
                <br />
                <a
                  href={`https://testnet.xrpl.org/transactions/${result.item.xrpl_burn_tx_hash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {result.item.xrpl_burn_tx_hash}
                </a>
              </p>
            ) : null}
          </>
        ) : null}
        {result?.kind === "fail" ? (
          <p className="hint">The amount was refunded to the recipient's spendable balance.</p>
        ) : null}
      </Modal>
    </>
  )
}
