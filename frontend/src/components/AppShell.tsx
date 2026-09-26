import type { ReactNode } from "react"
import { NavLink, Navigate, useLocation } from "react-router-dom"
import { useAuth } from "../auth/useAuth"
import { GridTrail } from "../fx/GridTrail"
import { Nav } from "./Nav"
import {
  AdminKycIcon,
  BeneficiariesIcon,
  CashInIcon,
  CashOutIcon,
  CashOutsQueueIcon,
  ConfigIcon,
  HistoryIcon,
  HomeIcon,
  KycIcon,
  PlatformWalletIcon,
  ProfileIcon,
  SendIcon,
  SettlementIcon,
  WalletIcon,
} from "./icons"
import type { ComponentType } from "react"

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

interface NavItem {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
  end?: boolean
}

const ACCOUNT_ITEMS: NavItem[] = [
  { to: "/app", label: "Home", icon: HomeIcon, end: true },
  { to: "/app/profile", label: "Profile", icon: ProfileIcon },
  { to: "/app/kyc", label: "KYC", icon: KycIcon },
  { to: "/app/beneficiaries", label: "Beneficiaries", icon: BeneficiariesIcon },
  { to: "/app/send", label: "New quote", icon: SendIcon },
  { to: "/app/history", label: "History", icon: HistoryIcon },
  { to: "/app/wallet", label: "Wallet", icon: WalletIcon },
  { to: "/app/cash-out", label: "Cash-out", icon: CashOutIcon },
]

const ADMIN_ITEMS: NavItem[] = [
  { to: "/admin/kyc", label: "KYC queue", icon: AdminKycIcon },
  { to: "/admin/cash-in", label: "Cash-in", icon: CashInIcon },
  { to: "/admin/settlement", label: "Settlement", icon: SettlementIcon },
  { to: "/admin/cash-out", label: "Cash-outs", icon: CashOutsQueueIcon },
  { to: "/admin/config", label: "Config", icon: ConfigIcon },
  { to: "/admin/platform-wallet", label: "Platform wallet", icon: PlatformWalletIcon },
]

function NavTiles({ items }: { items: NavItem[] }) {
  return (
    <div className="nav-tiles">
      {items.map(({ to, label, icon: ItemIcon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `nav-tile${isActive ? " is-active" : ""}`}
        >
          <span className="nav-tile__icon">
            <ItemIcon />
          </span>
          <span className="nav-tile__label">{label}</span>
        </NavLink>
      ))}
    </div>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  return (
    <div className="app-shell">
      <GridTrail />
      <Nav />
      <aside className="app-side">
        <p className="nav-section-label">Account</p>
        <NavTiles items={ACCOUNT_ITEMS} />
        {user?.role === "admin" ? (
          <>
            <p className="nav-section-label">Admin</p>
            <NavTiles items={ADMIN_ITEMS} />
          </>
        ) : null}
      </aside>
      <main className="app-main">{children}</main>
    </div>
  )
}
