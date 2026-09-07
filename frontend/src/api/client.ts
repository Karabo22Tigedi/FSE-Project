import type {
  Beneficiary,
  BeneficiaryCreate,
  CashOut,
  FeeConfig,
  KycOut,
  KycStatusOut,
  KycSubmit,
  LimitStatus,
  LimitTier,
  PlatformWalletStatus,
  Remittance,
  SettlementMessage,
  TokenResponse,
  User,
  Wallet,
} from "./types"
import { ApiError } from "./types"
import type { CashInMethod } from "./types"

const TOKEN_KEY = "xrpl_token"
const USER_KEY = "xrpl_user"

const envApiUrl = import.meta.env.VITE_API_URL
export const API_URL =
  envApiUrl === undefined || envApiUrl === ""
    ? import.meta.env.DEV
      ? "http://127.0.0.1:8000"
      : ""
    : envApiUrl

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function getStoredUser(): User | null {
  const raw = sessionStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export function setSession(token: string, user: User): void {
  sessionStorage.setItem(TOKEN_KEY, token)
  sessionStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession(): void {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(USER_KEY)
}

function detailFrom(body: unknown): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail
    if (typeof detail === "string") return detail
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (item && typeof item === "object" && "msg" in item) {
            return String((item as { msg: unknown }).msg)
          }
          return JSON.stringify(item)
        })
        .join("; ")
    }
  }
  return "Request failed"
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  const token = getToken()
  if (token) headers.set("Authorization", `Bearer ${token}`)

  const res = await fetch(`${API_URL}${path}`, { ...init, headers })
  if (res.status === 204) return undefined as T
  const text = await res.text()
  const body = text ? (JSON.parse(text) as unknown) : null
  if (!res.ok) {
    throw new ApiError(res.status, detailFrom(body))
  }
  return body as T
}

export const api = {
  register: (payload: {
    full_name: string
    email: string
    mobile_number: string
    password: string
  }) =>
    request<User>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  login: (email: string, password: string) =>
    request<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () => request<void>("/auth/logout", { method: "POST" }),

  me: () => request<User>("/users/me"),

  updateMe: (payload: Partial<Pick<User, "full_name" | "email" | "mobile_number">>) =>
    request<User>("/users/me", { method: "PATCH", body: JSON.stringify(payload) }),

  kycStatus: () => request<KycStatusOut>("/kyc/me/status"),

  kycMe: () => request<KycOut>("/kyc/me"),

  submitKyc: (payload: KycSubmit) =>
    request<KycOut>("/kyc", { method: "POST", body: JSON.stringify(payload) }),

  listKyc: (status?: string) =>
    request<KycOut[]>(status ? `/kyc?kyc_status=${encodeURIComponent(status)}` : "/kyc"),

  approveKyc: (id: string) => request<KycOut>(`/kyc/${id}/approve`, { method: "POST" }),

  rejectKyc: (id: string, rejection_reason?: string) =>
    request<KycOut>(`/kyc/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ rejection_reason: rejection_reason ?? null }),
    }),

  limits: () => request<LimitStatus>("/limits/me"),

  beneficiaries: () => request<Beneficiary[]>("/beneficiaries"),

  createBeneficiary: (payload: BeneficiaryCreate) =>
    request<Beneficiary>("/beneficiaries", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  createQuote: (beneficiary_id: string, zar_amount: string) =>
    request<Remittance>("/remittances", {
      method: "POST",
      body: JSON.stringify({ beneficiary_id, zar_amount }),
    }),

  myRemittances: () => request<Remittance[]>("/remittances/me"),

  allRemittances: () => request<Remittance[]>("/remittances"),

  track: (ref: string) => request<Remittance>(`/remittances/track/${encodeURIComponent(ref)}`),

  cancelQuote: (id: string) => request<Remittance>(`/remittances/${id}/cancel`, { method: "POST" }),

  cashIn: (id: string, method: CashInMethod) =>
    request<Remittance>(`/remittances/${id}/cash-in`, {
      method: "POST",
      body: JSON.stringify({ method }),
    }),

  confirmCashIn: (id: string) =>
    request<Remittance>(`/remittances/${id}/confirm-cash-in`, { method: "POST" }),

  wallet: () => request<Wallet>("/wallet/me"),

  createCashOut: (rlusd_amount: string, fiat_currency: string) =>
    request<CashOut>("/cash-outs", {
      method: "POST",
      body: JSON.stringify({ rlusd_amount, fiat_currency }),
    }),

  myCashOuts: () => request<CashOut[]>("/cash-outs/me"),

  allCashOuts: () => request<CashOut[]>("/cash-outs"),

  approveCashOut: (id: string) => request<CashOut>(`/cash-outs/${id}/approve`, { method: "POST" }),

  completeCashOut: (id: string) => request<CashOut>(`/cash-outs/${id}/complete`, { method: "POST" }),

  failCashOut: (id: string) => request<CashOut>(`/cash-outs/${id}/fail`, { method: "POST" }),

  settlement: () => request<SettlementMessage[]>("/admin/settlement"),

  runSettlement: () => request<SettlementMessage[]>("/admin/settlement/run", { method: "POST" }),

  retrySettlement: (id: string) =>
    request<SettlementMessage>(`/admin/settlement/${id}/retry`, { method: "POST" }),

  feeConfig: () => request<FeeConfig>("/admin/fee-config"),

  updateFeeConfig: (payload: Partial<FeeConfig>) =>
    request<FeeConfig>("/admin/fee-config", { method: "PUT", body: JSON.stringify(payload) }),

  limitTiers: () => request<LimitTier[]>("/admin/limit-tiers"),

  updateLimitTier: (tier_key: string, payload: Partial<LimitTier>) =>
    request<LimitTier>(`/admin/limit-tiers/${encodeURIComponent(tier_key)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  platformWallet: () => request<PlatformWalletStatus>("/admin/platform-wallet"),

  establishPlatformTrustline: () =>
    request<PlatformWalletStatus>("/admin/platform-wallet/trustline", { method: "POST" }),
}
