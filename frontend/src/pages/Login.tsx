import { useState } from "react"
import type { FormEvent } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { ApiError } from "../api/types"
import { useAuth } from "../auth/AuthContext"
import { Nav } from "../components/Nav"

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? "/app"
  const registered = Boolean((location.state as { registered?: boolean } | null)?.registered)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")
    setBusy(true)
    try {
      const user = await login(email, password)
      navigate(user.role === "admin" ? "/admin/kyc" : from, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not sign in")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <Nav />
      <h1>Sign in</h1>
      <p className="page-lead">Use the email and password for your Group 3 remittance account.</p>
      {registered ? (
        <p className="banner banner--ok">Account created. Sign in to continue to KYC.</p>
      ) : null}
      {error ? <p className="banner banner--error">{error}</p> : null}
      <form className="form-grid" onSubmit={(e) => void onSubmit(e)}>
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
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="current-password"
          />
        </label>
        <button className="pill" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Login"}
        </button>
      </form>
      <p className="muted">
        New here? <Link to="/register">Register</Link>
      </p>
    </div>
  )
}
