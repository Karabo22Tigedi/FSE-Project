import { useContext } from "react"
import { AuthContext } from "./state"
import type { AuthState } from "./state"

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
