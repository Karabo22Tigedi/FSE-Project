import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { api } from "../../api/client"
import type { FeeConfig, LimitTier } from "../../api/types"
import { useAuth } from "../../auth/useAuth"
import { errorDetail } from "../app/format"
import { staggerStyle, tierLabel } from "../app/walletFormat"

const emptyFees: FeeConfig = {
  fixed_fee_zar: "",
  percentage_fee: "",
  fx_margin_percentage: "",
  cash_out_fee_percentage: "",
}

export function Config() {
  const { user } = useAuth()
  const [fees, setFees] = useState<FeeConfig>(emptyFees)
  const [tiers, setTiers] = useState<LimitTier[]>([])
  const [error, setError] = useState("")
  const [ok, setOk] = useState("")
  const [loading, setLoading] = useState(true)
  const [savingFees, setSavingFees] = useState(false)
  const [savingTier, setSavingTier] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError("")
      try {
        const [feeConfig, limitTiers] = await Promise.all([api.feeConfig(), api.limitTiers()])
        if (cancelled) return
        setFees(feeConfig)
        setTiers(limitTiers)
        setReady(true)
      } catch (err) {
        if (!cancelled) setError(errorDetail(err, "Could not load configuration"))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  function setFee<K extends keyof FeeConfig>(key: K, value: string) {
    setFees((prev) => ({ ...prev, [key]: value }))
  }

  function setTierField(tierKey: string, field: "daily_limit_zar" | "monthly_limit_zar", value: string) {
    setTiers((prev) =>
      prev.map((tier) => (tier.tier_key === tierKey ? { ...tier, [field]: value } : tier)),
    )
  }

  async function saveFees(e: FormEvent) {
    e.preventDefault()
    setError("")
    setOk("")
    setSavingFees(true)
    try {
      const updated = await api.updateFeeConfig({
        fixed_fee_zar: fees.fixed_fee_zar,
        percentage_fee: fees.percentage_fee,
        fx_margin_percentage: fees.fx_margin_percentage,
        cash_out_fee_percentage: fees.cash_out_fee_percentage,
      })
      setFees(updated)
      setOk("Fee configuration saved.")
    } catch (err) {
      setError(errorDetail(err, "Could not update fees"))
    } finally {
      setSavingFees(false)
    }
  }

  async function saveTier(e: FormEvent, tier: LimitTier) {
    e.preventDefault()
    setError("")
    setOk("")
    setSavingTier(tier.tier_key)
    try {
      const updated = await api.updateLimitTier(tier.tier_key, {
        daily_limit_zar: tier.daily_limit_zar,
        monthly_limit_zar: tier.monthly_limit_zar,
      })
      setTiers((prev) => prev.map((row) => (row.tier_key === updated.tier_key ? updated : row)))
      setOk(`${tierLabel(updated.tier_key)} limits saved.`)
    } catch (err) {
      setError(errorDetail(err, "Could not update limit tier"))
    } finally {
      setSavingTier(null)
    }
  }

  return (
    <>
      <h1>Config</h1>
      <p className="page-lead">
        {user ? `${user.full_name}. ` : null}
        Fee parameters and daily/monthly ZAR limits per KYC tier.
      </p>
      {error ? <p className="banner banner--error">{error}</p> : null}
      {ok ? <p className="banner banner--ok">{ok}</p> : null}
      {loading ? <p className="muted">Loading configuration…</p> : null}
      {!loading && !ready && error ? (
        <article className="app-card stagger-in" style={staggerStyle(0)}>
          <h2>Configuration unavailable</h2>
          <p className="empty-state">Fee and limit settings could not be loaded.</p>
        </article>
      ) : null}

      {ready ? (
        <>
          <article className="app-card stagger-in" style={staggerStyle(0)}>
            <h2>Fees</h2>
            <p className="hint">Percentage fields are decimal fractions (0.01 = 1%).</p>
            <form className="form-grid" onSubmit={(e) => void saveFees(e)}>
              <label>
                fixed_fee_zar
                <input
                  value={fees.fixed_fee_zar}
                  onChange={(e) => setFee("fixed_fee_zar", e.target.value)}
                  required
                />
              </label>
              <label>
                percentage_fee
                <input
                  value={fees.percentage_fee}
                  onChange={(e) => setFee("percentage_fee", e.target.value)}
                  required
                />
              </label>
              <label>
                fx_margin_percentage
                <input
                  value={fees.fx_margin_percentage}
                  onChange={(e) => setFee("fx_margin_percentage", e.target.value)}
                  required
                />
              </label>
              <label>
                cash_out_fee_percentage
                <input
                  value={fees.cash_out_fee_percentage}
                  onChange={(e) => setFee("cash_out_fee_percentage", e.target.value)}
                  required
                />
              </label>
              <button className="pill" type="submit" disabled={savingFees || loading}>
                {savingFees ? "Saving…" : "Save fees"}
              </button>
            </form>
          </article>

          <article className="app-card stagger-in" style={staggerStyle(1)}>
            <h2>Limit tiers</h2>
            <p className="hint">Daily and monthly ZAR caps per tier.</p>
            {tiers.length === 0 ? (
              <p className="empty-state">No limit tiers configured.</p>
            ) : (
              <div className="row-list">
                {tiers.map((tier) => (
                  <div className="metric" key={tier.tier_key}>
                    <h3 className="tier-title">{tierLabel(tier.tier_key)}</h3>
                    <form className="form-grid" onSubmit={(e) => void saveTier(e, tier)}>
                      <label>
                        Daily ZAR
                        <input
                          value={tier.daily_limit_zar}
                          onChange={(e) => setTierField(tier.tier_key, "daily_limit_zar", e.target.value)}
                          required
                        />
                      </label>
                      <label>
                        Monthly ZAR
                        <input
                          value={tier.monthly_limit_zar}
                          onChange={(e) =>
                            setTierField(tier.tier_key, "monthly_limit_zar", e.target.value)
                          }
                          required
                        />
                      </label>
                      <button className="pill" type="submit" disabled={savingTier === tier.tier_key}>
                        {savingTier === tier.tier_key ? "Saving…" : "Save tier"}
                      </button>
                    </form>
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
