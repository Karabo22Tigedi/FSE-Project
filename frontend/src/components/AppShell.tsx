import type { ReactNode } from "react"
import { Link, Navigate, useLocation } from "react-router-dom"
import { useAuth } from "../auth/useAuth"
import { GridTrail } from "../fx/GridTrail"
import { Nav } from "./Nav"

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) {
    return (
      <div className="preloader">
        <div className="preloader__text">Loading...</div>
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  if (!ready) {
    return (
      <div className="preloader">
        <div className="preloader__text">Loading...</div>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== "admin") return <Navigate to="/app" replace />
  return children
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  return (
    <div className="app-shell">
      <GridTrail />
      <Nav />
      <aside className="app-side">
        <Link to="/app">Home</Link>
        <Link to="/app/profile">Profile</Link>
        <Link to="/app/kyc">KYC</Link>
        <Link to="/app/beneficiaries">Beneficiaries</Link>
        <Link to="/app/send">New quote</Link>
        <Link to="/app/history">History</Link>
        <Link to="/app/wallet">Wallet</Link>
        <Link to="/app/cash-out">Cash-out</Link>
        {user?.role === "admin" ? (
          <>
            <Link to="/admin/kyc">Admin KYC</Link>
            <Link to="/admin/cash-in">Cash-in</Link>
            <Link to="/admin/settlement">Settlement</Link>
            <Link to="/admin/cash-out">Cash-outs</Link>
            <Link to="/admin/config">Config</Link>
            <Link to="/admin/platform-wallet">Platform wallet</Link>
          </>
        ) : null}
      </aside>
      <main className="app-main">{children}</main>
    </div>
  )
}
