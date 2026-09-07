import type { ReactNode } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { AuthProvider } from "./auth/AuthContext"
import { AppShell, RequireAdmin, RequireAuth } from "./components/AppShell"
import { CashIn } from "./pages/admin/CashIn"
import { CashOutQueue } from "./pages/admin/CashOutQueue"
import { Config } from "./pages/admin/Config"
import { KycQueue } from "./pages/admin/KycQueue"
import { PlatformWallet } from "./pages/admin/PlatformWallet"
import { Settlement } from "./pages/admin/Settlement"
import { Beneficiaries } from "./pages/app/Beneficiaries"
import { CashOut } from "./pages/app/CashOut"
import { History } from "./pages/app/History"
import { Home } from "./pages/app/Home"
import { Kyc } from "./pages/app/Kyc"
import { Quote } from "./pages/app/Quote"
import { Send } from "./pages/app/Send"
import { Track } from "./pages/app/Track"
import { Wallet } from "./pages/app/Wallet"
import { Landing } from "./pages/Landing"
import { Login } from "./pages/Login"
import { Register } from "./pages/Register"

function Customer({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  )
}

function Admin({ children }: { children: ReactNode }) {
  return (
    <RequireAdmin>
      <AppShell>{children}</AppShell>
    </RequireAdmin>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/contact" element={<Navigate to="/#contact" replace />} />
          <Route
            path="/app"
            element={
              <Customer>
                <Home />
              </Customer>
            }
          />
          <Route
            path="/app/kyc"
            element={
              <Customer>
                <Kyc />
              </Customer>
            }
          />
          <Route
            path="/app/beneficiaries"
            element={
              <Customer>
                <Beneficiaries />
              </Customer>
            }
          />
          <Route
            path="/app/send"
            element={
              <Customer>
                <Send />
              </Customer>
            }
          />
          <Route
            path="/app/send/:id"
            element={
              <Customer>
                <Quote />
              </Customer>
            }
          />
          <Route
            path="/app/history"
            element={
              <Customer>
                <History />
              </Customer>
            }
          />
          <Route
            path="/app/track/:ref"
            element={
              <Customer>
                <Track />
              </Customer>
            }
          />
          <Route
            path="/app/wallet"
            element={
              <Customer>
                <Wallet />
              </Customer>
            }
          />
          <Route
            path="/app/cash-out"
            element={
              <Customer>
                <CashOut />
              </Customer>
            }
          />
          <Route
            path="/admin/kyc"
            element={
              <Admin>
                <KycQueue />
              </Admin>
            }
          />
          <Route
            path="/admin/cash-in"
            element={
              <Admin>
                <CashIn />
              </Admin>
            }
          />
          <Route
            path="/admin/settlement"
            element={
              <Admin>
                <Settlement />
              </Admin>
            }
          />
          <Route
            path="/admin/cash-out"
            element={
              <Admin>
                <CashOutQueue />
              </Admin>
            }
          />
          <Route
            path="/admin/config"
            element={
              <Admin>
                <Config />
              </Admin>
            }
          />
          <Route
            path="/admin/platform-wallet"
            element={
              <Admin>
                <PlatformWallet />
              </Admin>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
