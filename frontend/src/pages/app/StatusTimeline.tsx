import type { Remittance, RemittanceStatus } from "../../api/types"
import {
  cashInLabel,
  formatDateTime,
  formatPct,
  formatRate,
  formatRlusd,
  formatZar,
  remittanceLabel,
} from "./format"

type StepState = "done" | "current" | "todo"

interface Step {
  key: string
  label: string
  state: StepState
}

function buildSteps(status: RemittanceStatus, expired: boolean): Step[] {
  if (status === "cancelled") {
    return [
      { key: "quoted", label: "Quoted", state: "done" },
      { key: "cancelled", label: "Cancelled", state: "current" },
    ]
  }

  const terminalFailed = status === "settlement_failed"
  const flow = [
    { key: "quoted", label: expired && status === "quoted" ? "Quoted — expired" : "Quoted" },
    { key: "cash_in_pending", label: "Cash-in pending" },
    { key: "cash_in_confirmed", label: "Cash-in confirmed" },
    { key: "settlement_queued", label: "Settlement queued" },
    {
      key: terminalFailed ? "settlement_failed" : "settled",
      label: terminalFailed ? "Settlement failed" : "Settled",
    },
  ]

  const currentIndex: Record<RemittanceStatus, number> = {
    quoted: 0,
    cancelled: 0,
    cash_in_pending: 1,
    cash_in_confirmed: 2,
    settlement_queued: 3,
    settled: 4,
    settlement_failed: 4,
  }

  const current = currentIndex[status]

  return flow.map((step, i) => {
    if (status === "settled") {
      return { ...step, state: "done" as const }
    }
    let state: StepState = "todo"
    if (i < current) state = "done"
    else if (i === current) state = "current"
    return { ...step, state }
  })
}

export function Badge({ status, label }: { status: string; label: string }) {
  return <span className={`status-badge status-badge--${status}`}>{label}</span>
}

export function StatusTimeline({
  status,
  expired = false,
}: {
  status: RemittanceStatus
  expired?: boolean
}) {
  const steps = buildSteps(status, expired)
  return (
    <ol className="timeline">
      {steps.map((step) => (
        <li key={step.key} className={`timeline__step timeline__step--${step.state}`}>
          <span className="timeline__dot" />
          <div>{step.label}</div>
        </li>
      ))}
    </ol>
  )
}

export function QuoteBreakdown({ remittance }: { remittance: Remittance }) {
  return (
    <dl className="kv">
      <dt>Send amount</dt>
      <dd>{formatZar(remittance.zar_amount)}</dd>
      <dt>Locked transaction fee</dt>
      <dd>{formatZar(remittance.transaction_fee_zar)}</dd>
      <dt>FX margin</dt>
      <dd>{formatPct(remittance.fx_margin_percentage)}</dd>
      <dt>Exchange rate</dt>
      <dd>{formatRate(remittance.exchange_rate)}</dd>
      <dt>UCTUSD</dt>
      <dd>{formatRlusd(remittance.rlusd_amount)}</dd>
      <dt>Est. cash-out fee</dt>
      <dd>
        {formatRlusd(remittance.estimated_cash_out_fee)} ({formatPct(remittance.cash_out_fee_percentage)})
      </dd>
      <dt>Est. recipient payout</dt>
      <dd>{formatRlusd(remittance.estimated_recipient_payout)}</dd>
      <dt>Tracking ref</dt>
      <dd className="mono">{remittance.tracking_ref}</dd>
      <dt>Created</dt>
      <dd>{formatDateTime(remittance.created_at)}</dd>
      {remittance.cash_in_method ? (
        <>
          <dt>Cash-in method</dt>
          <dd>{cashInLabel(remittance.cash_in_method)}</dd>
        </>
      ) : null}
    </dl>
  )
}

export function TxHash({ hash }: { hash: string | null }) {
  if (!hash) return null
  return (
    <p className="mono">
      XRPL settlement hash
      <br />
      {hash}
    </p>
  )
}

export function RemittanceBadge({
  status,
  expired = false,
}: {
  status: RemittanceStatus
  expired?: boolean
}) {
  if (status === "quoted" && expired) {
    return <Badge status="expired" label="Expired" />
  }
  return <Badge status={status} label={remittanceLabel(status)} />
}
