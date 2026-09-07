import type { CSSProperties } from "react"
import type { CashInMethod, CashOutStatus, SettlementStatus } from "../../api/types"
import { cashInLabel, formatDateTime, formatZar } from "./format"

export function staggerStyle(index: number): CSSProperties {
  return { ["--i"]: String(index) } as CSSProperties
}

export function formatOptionalDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  return formatDateTime(iso)
}

export function formatFiat(value: string, currency: string): string {
  if (currency === "ZAR") return formatZar(value)
  const n = Number(value)
  if (!Number.isFinite(n)) return `${value} ${currency}`
  return `${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}

export function isZeroAmount(value: string): boolean {
  const n = Number(value)
  return Number.isFinite(n) && n === 0
}

export function methodLabel(method: CashInMethod | null): string {
  return method ? cashInLabel(method) : "—"
}

export function cashOutLabel(status: string): string {
  switch (status) {
    case "requested":
      return "Requested"
    case "approved":
      return "Approved"
    case "completed":
      return "Completed"
    case "failed":
      return "Failed"
    default:
      return status.replaceAll("_", " ")
  }
}

export function settlementLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Pending"
    case "processing":
      return "Processing"
    case "completed":
      return "Completed"
    case "failed":
      return "Failed"
    default:
      return status.replaceAll("_", " ")
  }
}

export function tierLabel(tierKey: string): string {
  if (tierKey === "unverified") return "Unverified"
  if (tierKey === "verified") return "Verified"
  return tierKey
}

export function canRetrySettlement(status: SettlementStatus | string): boolean {
  return status === "pending" || status === "processing" || status === "failed"
}

export function cashOutActions(status: CashOutStatus | string): {
  approve: boolean
  complete: boolean
  fail: boolean
} {
  return {
    approve: status === "requested",
    complete: status === "approved",
    fail: status === "requested" || status === "approved",
  }
}
