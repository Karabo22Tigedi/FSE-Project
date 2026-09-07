import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { api } from "../../api/client"
import type { Wallet as WalletData } from "../../api/types"
import { useAuth } from "../../auth/AuthContext"
import { errorDetail, formatRlusd, remittanceLabel } from "./format"
import { Badge } from "./StatusTimeline"
import {
  cashOutLabel,
  formatFiat,
  formatOptionalDate,
  isZeroAmount,
  staggerStyle,
} from "./walletFormat"

function incomingLabel(status: string): string {
  switch (status) {
    case "quoted":
    case "cancelled":
    case "cash_in_pending":
    case "cash_in_confirmed":
    case "settlement_queued":
    case "settled":
    case "settlement_failed":
      return remittanceLabel(status)
    default:
      return status.replaceAll("_", " ")
  }
}

export function Wallet() {
  const { user } = useAuth()
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError("")
      try {
        const data = await api.wallet()
        if (!cancelled) setWallet(data)
      } catch (err) {
        if (!cancelled) {
          setWallet(null)
          setError(errorDetail(err, "Could not load wallet"))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <h1>Wallet</h1>
      <p className="page-lead">
        {user ? `${user.full_name}. ` : null}
        Spendable UCTUSD is what you can cash out. On-chain is spendable plus amounts
        reserved for cash-outs that are requested or approved. Completing a cash-out
        burns UCTUSD to the issuer, so the on-chain balance drops.
      </p>
      {error ? <p className="banner banner--error">{error}</p> : null}
      {loading ? <p className="muted">Loading wallet…</p> : null}
      {!loading && error && !wallet ? (
        <article className="app-card stagger-in" style={staggerStyle(0)}>
          <h2>Wallet unavailable</h2>
          <p className="empty-state">We could not load your balances. Sign in again if this continues.</p>
        </article>
      ) : null}

      {wallet ? (
        <>
          <article className="app-card stagger-in" style={staggerStyle(0)}>
            <h2>Balances</h2>
            <div className="metric-row">
              <div className="metric">
                <div className="metric__label">Spendable</div>
                <div className="metric__value">{formatRlusd(wallet.spendable_balance)}</div>
                <p className="hint">spendable_balance / balance_rlusd</p>
                <p className="mono hint">{wallet.balance_rlusd}</p>
              </div>
              <div className="metric">
                <div className="metric__label">On-chain</div>
                <div className="metric__value">{formatRlusd(wallet.on_chain_balance)}</div>
                <p className="hint">on_chain_balance</p>
                <p className="mono hint">{wallet.on_chain_balance}</p>
              </div>
            </div>
            <div className="action-row">
              <Link className="pill" to="/app/cash-out">
                Cash out
              </Link>
            </div>
          </article>

          <article className="app-card stagger-in" style={staggerStyle(1)}>
            <h2>XRPL address</h2>
            {wallet.xrpl_address ? (
              <p className="mono">{wallet.xrpl_address}</p>
            ) : (
              <>
                <p className="empty-state">Not provisioned yet.</p>
                {isZeroAmount(wallet.spendable_balance) ? (
                  <p className="hint">
                    Spendable balance is zero. An address and TrustLine are created when the
                    first incoming remittance settles (a TrustLine is required before the
                    wallet can hold UCTUSD).
                  </p>
                ) : null}
              </>
            )}
          </article>

          <article className="app-card stagger-in" style={staggerStyle(2)}>
            <h2>Incoming transfers</h2>
            {wallet.incoming_transfers.length === 0 ? (
              <p className="empty-state">No incoming transfers yet.</p>
            ) : (
              <div className="row-list">
                {wallet.incoming_transfers.map((tx) => (
                  <div className="metric" key={tx.remittance_id}>
                    <div className="title-row">
                      <strong>{formatRlusd(tx.rlusd_amount)}</strong>
                      <Badge status={tx.status} label={incomingLabel(tx.status)} />
                    </div>
                    <p className="hint">Date {formatOptionalDate(tx.settled_at ?? tx.created_at)}</p>
                    <p className="mono hint">Hash {tx.xrpl_tx_hash ?? "—"}</p>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="app-card stagger-in" style={staggerStyle(3)}>
            <h2>Cash-out transactions</h2>
            {wallet.cash_out_transactions.length === 0 ? (
              <p className="empty-state">No cash-out requests yet.</p>
            ) : (
              <div className="row-list">
                {wallet.cash_out_transactions.map((tx) => (
                  <div className="metric" key={tx.id}>
                    <div className="title-row">
                      <strong>{formatRlusd(tx.rlusd_amount)}</strong>
                      <Badge status={tx.status} label={cashOutLabel(tx.status)} />
                    </div>
                    <p className="hint">
                      Payout {formatFiat(tx.fiat_payout_amount, tx.fiat_currency)} ·{" "}
                      {formatOptionalDate(tx.completed_at ?? tx.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </article>
        </>
      ) : null}
    </>
  )
}
