import { useState } from "react"
import type { FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { api } from "../api/client"
import { ApiError } from "../api/types"
import { Nav } from "../components/Nav"
import { GridTrail } from "../fx/GridTrail"

export function Register() {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [mobile, setMobile] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")
    setBusy(true)
    try {
      await api.register({
        full_name: fullName,
        email,
        mobile_number: mobile,
        password,
      })
      navigate("/login", { replace: true, state: { registered: true } })
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not register")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <GridTrail />
      <Nav />
      <h1>Create an account</h1>
      <p className="page-lead">
        After you sign in you will complete KYC. An administrator must approve it before you can
        send.
      </p>
      {error ? <p className="banner banner--error">{error}</p> : null}
      <form className="form-grid" onSubmit={(e) => void onSubmit(e)}>
        <label>
          Full name
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label>
          Mobile
          <input
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            required
            minLength={5}
            autoComplete="tel"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>
        <p className="hint">At least 8 characters.</p>
        <button className="pill" type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="muted">
        Already registered? <Link to="/login">Login</Link>
      </p>
    </div>
  )
}
