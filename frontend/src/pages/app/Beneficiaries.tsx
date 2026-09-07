import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { Link } from "react-router-dom"
import { api } from "../../api/client"
import { ApiError } from "../../api/types"
import type { Beneficiary, KycStatusOut } from "../../api/types"
import { errorDetail, formatDateTime } from "./format"
import { Badge, staggerStyle } from "./StatusTimeline"

export function Beneficiaries() {
  const [people, setPeople] = useState<Beneficiary[]>([])
  const [kyc, setKyc] = useState<KycStatusOut | null>(null)
  const [fullName, setFullName] = useState("")
  const [mobile, setMobile] = useState("")
  const [email, setEmail] = useState("")
  const [country, setCountry] = useState("")
  const [payoutCurrency, setPayoutCurrency] = useState("USD")
  const [relationship, setRelationship] = useState("")
  const [error, setError] = useState("")
  const [ok, setOk] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function refreshList() {
    const list = await api.beneficiaries()
    setPeople(list)
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError("")
      try {
        const [list, status] = await Promise.all([api.beneficiaries(), api.kycStatus()])
        if (cancelled) return
        setPeople(list)
        setKyc(status)
      } catch (err) {
        if (!cancelled) setError(errorDetail(err, "Could not load beneficiaries"))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const canAdd = kyc?.status === "approved"

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")
    setOk("")
    const mobileTrim = mobile.trim()
    const emailTrim = email.trim()
    if (!mobileTrim && !emailTrim) {
      setError("Provide a mobile number or an email address (at least one).")
      return
    }
    setSaving(true)
    try {
      await api.createBeneficiary({
        full_name: fullName.trim(),
        country: country.trim(),
        payout_currency: payoutCurrency.trim(),
        relationship_to_sender: relationship.trim(),
        ...(mobileTrim ? { mobile_number: mobileTrim } : {}),
        ...(emailTrim ? { email_address: emailTrim } : {}),
      })
      setFullName("")
      setMobile("")
      setEmail("")
      setCountry("")
      setPayoutCurrency("USD")
      setRelationship("")
      setOk("Beneficiary saved.")
      await refreshList()
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError(err.detail)
      } else {
        setError(errorDetail(err, "Could not add beneficiary"))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <h1>Beneficiaries</h1>
      <p className="page-lead">People you send to. Linked means we matched a wallet on this platform.</p>
      {loading ? <p className="muted">Loading beneficiaries…</p> : null}
      {error ? <p className="banner banner--error">{error}</p> : null}
      {ok ? <p className="banner banner--ok">{ok}</p> : null}

      {!canAdd && kyc ? (
        <article className="app-card stagger-in" style={staggerStyle(0)}>
          <h2>KYC required</h2>
          <p>
            Adding a beneficiary needs approved KYC.
            {kyc.status === "pending"
              ? " Your application is waiting for an administrator."
              : kyc.status === "rejected"
                ? " Resubmit your application after a rejection."
                : " Submit KYC first."}
          </p>
          <div className="action-row">
            <Link className="pill" to="/app/kyc">
              Go to KYC
            </Link>
          </div>
        </article>
      ) : null}

      {canAdd ? (
        <article className="app-card stagger-in" style={staggerStyle(0)}>
          <h2>Add beneficiary</h2>
          <form className="form-grid" onSubmit={(e) => void onSubmit(e)}>
            <label>
              Full name
              <input
                name="full_name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                maxLength={200}
              />
            </label>
            <label>
              Mobile number
              <input
                name="mobile_number"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                minLength={5}
                maxLength={32}
              />
            </label>
            <label>
              Email address
              <input
                name="email_address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <p className="hint">At least a mobile number or an email address is required.</p>
            <label>
              Country
              <input
                name="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                required
                maxLength={100}
              />
            </label>
            <label>
              Payout currency
              <select
                name="payout_currency"
                value={payoutCurrency}
                onChange={(e) => setPayoutCurrency(e.target.value)}
              >
                <option value="USD">USD</option>
                <option value="ZAR">ZAR</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="MWK">MWK</option>
                <option value="ZMW">ZMW</option>
                <option value="BWP">BWP</option>
                <option value="NAD">NAD</option>
              </select>
            </label>
            <label>
              Relationship to sender
              <input
                name="relationship_to_sender"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                required
                maxLength={100}
                placeholder="Family, friend, …"
              />
            </label>
            <button className="pill" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Add beneficiary"}
            </button>
          </form>
        </article>
      ) : null}

      <article className="app-card stagger-in" style={staggerStyle(1)}>
        <h2>Your list</h2>
        {people.length === 0 && !loading ? (
          <p className="empty-state">No beneficiaries yet. Add someone to send to.</p>
        ) : (
          <div className="row-list">
            {people.map((person, index) => (
              <article
                key={person.id}
                className="app-card stagger-in"
                style={staggerStyle(index + 2)}
              >
                <div className="title-row">
                  <h2>{person.full_name}</h2>
                  {person.linked_user_id ? (
                    <Badge status="linked" label="Linked" />
                  ) : (
                    <Badge status="unlinked" label="Unlinked" />
                  )}
                </div>
                <p className="muted">
                  {person.country} · {person.payout_currency} · {person.relationship_to_sender}
                </p>
                <p className="hint">
                  {person.mobile_number ?? "No mobile"}
                  {person.email_address ? ` · ${person.email_address}` : ""}
                </p>
                <p className="hint">
                  {person.wallet_provisioned ? "Wallet provisioned" : "Wallet not provisioned"}
                  {" · "}
                  Added {formatDateTime(person.created_at)}
                </p>
              </article>
            ))}
          </div>
        )}
      </article>
    </>
  )
}
