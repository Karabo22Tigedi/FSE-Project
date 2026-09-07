import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { api } from "../../api/client"
import { ApiError } from "../../api/types"
import type { KycStatus, KycStatusOut, KycSubmit } from "../../api/types"
import { useAuth } from "../../auth/AuthContext"
import { errorDetail, kycLabel, toDateInput, todayInput } from "./format"
import { Badge, staggerStyle } from "./StatusTimeline"

const emptyForm = (): KycSubmit => ({
  full_name: "",
  date_of_birth: "",
  nationality: "",
  identification_number: "",
  residential_address: "",
  mobile_number: "",
  email_address: "",
  source_of_funds: "",
})

export function Kyc() {
  const { user } = useAuth()
  const [status, setStatus] = useState<KycStatusOut | null>(null)
  const [form, setForm] = useState<KycSubmit>(emptyForm)
  const [error, setError] = useState("")
  const [ok, setOk] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError("")
      try {
        const kycStatus = await api.kycStatus()
        if (cancelled) return
        setStatus(kycStatus)

        if (kycStatus.status === "not_submitted") {
          setForm({
            ...emptyForm(),
            full_name: user?.full_name ?? "",
            mobile_number: user?.mobile_number ?? "",
            email_address: user?.email ?? "",
          })
          return
        }

        try {
          const existing = await api.kycMe()
          if (cancelled) return
          setForm({
            full_name: existing.full_name,
            date_of_birth: toDateInput(existing.date_of_birth),
            nationality: existing.nationality,
            identification_number: existing.identification_number,
            residential_address: existing.residential_address,
            mobile_number: existing.mobile_number,
            email_address: existing.email_address,
            source_of_funds: existing.source_of_funds,
          })
        } catch (err) {
          if (err instanceof ApiError && err.status === 404) {
            setForm({
              ...emptyForm(),
              full_name: user?.full_name ?? "",
              mobile_number: user?.mobile_number ?? "",
              email_address: user?.email ?? "",
            })
            return
          }
          throw err
        }
      } catch (err) {
        if (!cancelled) setError(errorDetail(err, "Could not load KYC"))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [user])

  const kycState: KycStatus = status?.status ?? "not_submitted"
  const readOnly = kycState === "approved" || kycState === "pending"

  function patch<K extends keyof KycSubmit>(key: K, value: KycSubmit[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (readOnly) return
    setError("")
    setOk("")
    setSaving(true)
    try {
      const saved = await api.submitKyc({
        ...form,
        full_name: form.full_name.trim(),
        nationality: form.nationality.trim(),
        identification_number: form.identification_number.trim(),
        residential_address: form.residential_address.trim(),
        mobile_number: form.mobile_number.trim(),
        email_address: form.email_address.trim(),
        source_of_funds: form.source_of_funds.trim(),
      })
      setStatus({
        status: saved.status,
        rejection_reason: saved.rejection_reason,
        submitted_at: saved.submitted_at,
        reviewed_at: saved.reviewed_at,
      })
      setOk("Submitted. An administrator will review this before you can send.")
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(err.detail)
        try {
          const latest = await api.kycStatus()
          setStatus(latest)
          const existing = await api.kycMe()
          setForm({
            full_name: existing.full_name,
            date_of_birth: toDateInput(existing.date_of_birth),
            nationality: existing.nationality,
            identification_number: existing.identification_number,
            residential_address: existing.residential_address,
            mobile_number: existing.mobile_number,
            email_address: existing.email_address,
            source_of_funds: existing.source_of_funds,
          })
        } catch {
          /* status refresh is best-effort after 409 */
        }
        return
      }
      setError(errorDetail(err, "Could not submit KYC"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <h1>KYC</h1>
      <p className="page-lead">Identity details for FICA-style review. Sending stays locked until an administrator approves this application.</p>
      {loading ? <p className="muted">Loading KYC…</p> : null}
      {error ? <p className="banner banner--error">{error}</p> : null}
      {ok ? <p className="banner banner--ok">{ok}</p> : null}

      {status ? (
        <article className="app-card stagger-in" style={staggerStyle(0)}>
          <div className="title-row">
            <h2>Status</h2>
            <Badge status={status.status} label={kycLabel(status.status)} />
          </div>
          {status.status === "pending" ? (
            <p className="muted">Submitted. Wait for an administrator to approve or reject it.</p>
          ) : null}
          {status.status === "approved" ? (
            <p className="muted">Approved. These details are locked.</p>
          ) : null}
          {status.status === "rejected" ? (
            <p>
              Rejected{status.rejection_reason ? `: ${status.rejection_reason}` : "."} You can
              overwrite the application and resubmit.
            </p>
          ) : null}
          {status.status === "not_submitted" ? (
            <p className="muted">No application yet. Complete every field below.</p>
          ) : null}
        </article>
      ) : null}

      <article className="app-card stagger-in" style={staggerStyle(1)}>
        <h2>{readOnly ? "Application" : kycState === "rejected" ? "Resubmit" : "Submit"}</h2>
        <form className="form-grid" onSubmit={(e) => void onSubmit(e)}>
          <label>
            Full name
            <input
              name="full_name"
              value={form.full_name}
              onChange={(e) => patch("full_name", e.target.value)}
              required
              disabled={readOnly}
              maxLength={200}
            />
          </label>
          <label>
            Date of birth
            <input
              name="date_of_birth"
              type="date"
              value={form.date_of_birth}
              onChange={(e) => patch("date_of_birth", e.target.value)}
              required
              disabled={readOnly}
              max={todayInput()}
            />
          </label>
          <label>
            Nationality
            <input
              name="nationality"
              value={form.nationality}
              onChange={(e) => patch("nationality", e.target.value)}
              required
              disabled={readOnly}
              maxLength={100}
            />
          </label>
          <label>
            Identification number
            <input
              name="identification_number"
              value={form.identification_number}
              onChange={(e) => patch("identification_number", e.target.value)}
              required
              disabled={readOnly}
              maxLength={100}
            />
          </label>
          <label>
            Residential address
            <textarea
              name="residential_address"
              value={form.residential_address}
              onChange={(e) => patch("residential_address", e.target.value)}
              required
              disabled={readOnly}
              maxLength={1000}
              rows={3}
            />
          </label>
          <label>
            Mobile number
            <input
              name="mobile_number"
              value={form.mobile_number}
              onChange={(e) => patch("mobile_number", e.target.value)}
              required
              disabled={readOnly}
              minLength={5}
              maxLength={32}
            />
          </label>
          <label>
            Email address
            <input
              name="email_address"
              type="email"
              value={form.email_address}
              onChange={(e) => patch("email_address", e.target.value)}
              required
              disabled={readOnly}
            />
          </label>
          <label>
            Source of funds
            <textarea
              name="source_of_funds"
              value={form.source_of_funds}
              onChange={(e) => patch("source_of_funds", e.target.value)}
              required
              disabled={readOnly}
              maxLength={500}
              rows={3}
            />
          </label>
          {readOnly ? null : (
            <button className="pill" type="submit" disabled={saving}>
              {saving ? "Submitting…" : kycState === "rejected" ? "Resubmit KYC" : "Submit KYC"}
            </button>
          )}
        </form>
      </article>
    </>
  )
}
