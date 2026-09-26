import { useCallback, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { api, clearSession, getStoredUser, getToken, setSession } from "../api/client"
import { ApiError } from "../api/types"
import { AuthContext } from "./state"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState(getStoredUser)

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null)
      return
    }
    try {
      const me = await api.me()
      setUser(me)
      sessionStorage.setItem("xrpl_user", JSON.stringify(me))
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearSession()
        setUser(null)
      }
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password)
    setSession(res.access_token, res.user)
    setUser(res.user)
    return res.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      /* token may already be dead */
    }
    clearSession()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, ready: true, login, logout, refresh }),
    [user, login, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
