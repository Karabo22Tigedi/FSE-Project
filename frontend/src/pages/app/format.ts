import { clearSession } from "../../api/client"
import { ApiError } from "../../api/types"
import type { CashInMethod, KycStatus, RemittanceStatus } from "../../api/types"

export function errorDetail(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status === 401) {
    clearSession()
    const path = window.location.pathname
    if (path.startsWith("/app") || path.startsWith("/admin")) {
      window.location.assign("/login")
    }
    return err.detail
  }
  return err instanceof ApiError ? err.detail : fallback
}

export function kycLabel(status: KycStatus): string {
  switch (status) {
    case "not_submitted":
      return "Not submitted"
    case "pending":
      return "Pending review"
    case "approved":
      return "Approved"
    case "rejected":
      return "Rejected"
  }
}

export function remittanceLabel(status: RemittanceStatus): string {
  switch (status) {
    case "quoted":
      return "Quoted"
    case "cancelled":
      return "Cancelled"
    case "cash_in_pending":
      return "Cash-in pending"
    case "cash_in_confirmed":
      return "Cash-in confirmed"
    case "settlement_queued":
      return "Settlement queued"
    case "settled":
      return "Settled"
    case "settlement_failed":
      return "Settlement failed"
  }
}

export function cashInLabel(method: CashInMethod): string {
  switch (method) {
    case "agent_cash":
      return "Agent cash"
    case "bank_transfer":
      return "Bank transfer"
    case "card":
      return "Card"
  }
}

function asNumber(value: string): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function formatZar(value: string): string {
  const n = asNumber(value)
  if (n === null) return `${value} ZAR`
  return `${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ZAR`
}

export function formatRlusd(value: string): string {
  const n = asNumber(value)
  if (n === null) return `${value} UCTUSD`
  return `${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 6 })} UCTUSD`
}

export function formatPct(value: string): string {
  const n = asNumber(value)
  if (n === null) return `${value}%`
  // Backend stores fee/FX fields as fractions (0.01 = 1%), not whole percents.
  const asPercent = n > 0 && n <= 1 ? n * 100 : n
  return `${asPercent.toLocaleString("en-ZA", { maximumFractionDigits: 4 })}%`
}

export function formatRate(value: string): string {
  const n = asNumber(value)
  if (n === null) return value
  return n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 6 })
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function toDateInput(value: string): string {
  return value.slice(0, 10)
}

export function todayInput(): string {
  return new Date().toISOString().slice(0, 10)
}

export function isExpired(expiresAt: string, now = Date.now()): boolean {
  return new Date(expiresAt).getTime() <= now
}

export function formatCountdown(expiresAt: string, now = Date.now()): string {
  const ms = new Date(expiresAt).getTime() - now
  if (ms <= 0) return "Expired"
  const totalSec = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")} remaining`
}
