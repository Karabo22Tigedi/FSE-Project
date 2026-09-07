import { useEffect, useState } from "react"
import { api } from "../../api/client"
import { ApiError } from "../../api/types"
import type { PlatformWalletStatus } from "../../api/types"
import { useAuth } from "../../auth/AuthContext"
import { errorDetail } from "../app/format"
import { staggerStyle } from "../app/walletFormat"

export function PlatformWallet() {
  const { user } = useAuth()
  const [status, setStatus] = useState<PlatformWalletStatus | null>(null)
  const [error, setError] = useState("")
  const [ok, setOk] = useState("")
  const [loading, setLoading] = useState(true)
  const [notSetup, setNotSetup] = useState(false)
  const [establishing, setEstablishing] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError("")
      try {
        const data = await api.platformWallet()
        if (cancelled) return
        setStatus(data)
        setNotSetup(false)
      } catch (err) {
        if (!cancelled) {
          setStatus(null)
          if (err instanceof ApiError && err.status === 404) {
            setNotSetup(true)
          } else {
            setError(errorDetail(err, "Could not load platform wallet"))
          }
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

  async function copyAddress() {
    if (!status) return
    setError("")
    setOk("")
    try {
      await navigator.clipboard.writeText(status.classic_address)
      setOk("Address copied.")
    } catch {
      setError("Could not copy the platform address")
    }
  }

  async function establishTrustline() {
    setError("")
    setOk("")
    setEstablishing(true)
    try {
      const data = await api.establishPlatformTrustline()
      setStatus(data)
      setOk("TrustLine established.")
    } catch (err) {
      setError(errorDetail(err, "Could not establish TrustLine"))
    } finally {
      setEstablishing(false)
    }
  }

  return (
    <>
      <h1>Platform wallet</h1>
      <p className="page-lead">
        {user ? `${user.full_name}. ` : null}
        Treasury XRPL Testnet account that holds UCTUSD for settlement.
      </p>
      {error ? <p className="banner banner--error">{error}</p> : null}
      {ok ? <p className="banner banner--ok">{ok}</p> : null}
      {loading ? <p className="muted">Loading platform wallet…</p> : null}

      {!loading && notSetup ? (
        <article className="app-card stagger-in" style={staggerStyle(0)}>
          <h2>Not set up</h2>
          <p className="empty-state">
            Platform wallet is not set up. Run{" "}
            <span className="mono">python -m scripts.setup_platform_wallet</span>
          </p>
        </article>
      ) : null}

      {!loading && !notSetup && error && !status ? (
        <article className="app-card stagger-in" style={staggerStyle(0)}>
          <h2>Platform wallet unavailable</h2>
          <p className="empty-state">The platform wallet could not be loaded.</p>
        </article>
      ) : null}

      {status ? (
        <>
          {!status.liquidity_ready ? (
            <p className="banner banner--warn">
              Liquidity is not ready. Email this address to Marc for 100,000 UCTUSD
              (official course token — do not mint your own).
            </p>
          ) : null}

          <article className="app-card stagger-in" style={staggerStyle(0)}>
            <h2>Address</h2>
            <p className="mono">{status.classic_address}</p>
            <div className="action-row">
              <button className="pill" type="button" onClick={() => void copyAddress()}>
                Copy
              </button>
              {!status.trustline_established ? (
                <button
                  className="pill"
                  type="button"
                  disabled={establishing}
                  onClick={() => void establishTrustline()}
                >
                  {establishing ? "Establishing…" : "Establish TrustLine"}
                </button>
              ) : null}
            </div>
          </article>

          <article className="app-card stagger-in" style={staggerStyle(1)}>
            <h2>Status</h2>
            <dl className="kv">
              <dt>TrustLine</dt>
              <dd>{status.trustline_established ? "yes" : "no"}</dd>
              <dt>UCTUSD balance</dt>
              <dd className="mono">{status.uctusd_balance}</dd>
              <dt>XRP drops</dt>
              <dd className="mono">{status.xrp_drops}</dd>
              <dt>Issuer</dt>
              <dd className="mono">{status.issuer_address}</dd>
              <dt>Distributor</dt>
              <dd className="mono">{status.distributor_address}</dd>
              <dt>Currency symbol</dt>
              <dd>{status.currency_symbol}</dd>
              <dt>Network</dt>
              <dd>{status.network}</dd>
            </dl>
            <p className="hint">
              <a href={status.explorer_url} target="_blank" rel="noreferrer">
                View token on XRPL Testnet explorer
              </a>
            </p>
          </article>
        </>
      ) : null}
    </>
  )
}
