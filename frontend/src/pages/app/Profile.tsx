import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { api } from "../../api/client"
import { ApiError } from "../../api/types"
import type { User } from "../../api/types"
import { useAuth } from "../../auth/useAuth"
import { errorDetail } from "./format"
import { staggerStyle } from "./walletFormat"

type ProfileForm = Pick<User, "full_name" | "email" | "mobile_number">

const emptyForm = (): ProfileForm => ({
  full_name: "",
  email: "",
  mobile_number: "",
})

function fromUser(user: User): ProfileForm {
  return {
    full_name: user.full_name,
    email: user.email,
    mobile_number: user.mobile_number,
  }
}

export function Profile() {
  const { user: sessionUser, refresh } = useAuth()
  const [form, setForm] = useState<ProfileForm>(() =>
    sessionUser ? fromUser(sessionUser) : emptyForm(),
  )
  const [loaded, setLoaded] = useState(Boolean(sessionUser))
  const [error, setError] = useState("")
  const [ok, setOk] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError("")
      try {
        const me = await api.me()
        if (cancelled) return
        setForm(fromUser(me))
        setLoaded(true)
      } catch (err) {
        if (!cancelled) setError(errorDetail(err, "Could not load your profile"))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  function patch<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")
    setOk("")
    setSaving(true)
    try {
      const saved = await api.updateMe({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        mobile_number: form.mobile_number.trim(),
      })
      setForm(fromUser(saved))
      await refresh()
      setOk("Profile updated.")
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(err.detail)
        return
      }
      setError(errorDetail(err, "Could not update profile"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <h1>Profile</h1>
      <p className="page-lead">
        Your name, email, and mobile number. These are the details we use to identify your
        sending account.
      </p>
      {loading ? <p className="muted">Loading your profile…</p> : null}
      {error ? <p className="banner banner--error">{error}</p> : null}
      {ok ? <p className="banner banner--ok">{ok}</p> : null}

      {!loading && !loaded ? (
        <article className="app-card stagger-in" style={staggerStyle(0)}>
          <h2>Profile unavailable</h2>
          <p className="empty-state">We could not load your details. Sign in again if this continues.</p>
        </article>
      ) : null}

      {loaded ? (
        <article className="app-card stagger-in" style={staggerStyle(0)}>
          <h2>Basic details</h2>
          <form className="form-grid" onSubmit={(e) => void onSubmit(e)}>
            <label>
              Full name
              <input
                name="full_name"
                value={form.full_name}
                onChange={(e) => patch("full_name", e.target.value)}
                required
                maxLength={200}
                autoComplete="name"
              />
            </label>
            <label>
              Email
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={(e) => patch("email", e.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <label>
              Mobile number
              <input
                name="mobile_number"
                value={form.mobile_number}
                onChange={(e) => patch("mobile_number", e.target.value)}
                required
                minLength={5}
                maxLength={32}
                autoComplete="tel"
              />
            </label>
            <button className="pill" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </button>
          </form>
        </article>
      ) : null}
    </>
  )
}
