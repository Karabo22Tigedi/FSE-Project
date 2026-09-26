export type UserRole = "customer" | "admin"

export type KycStatus = "not_submitted" | "pending" | "approved" | "rejected"

export type RemittanceStatus =
  | "quoted"
  | "cancelled"
  | "cash_in_pending"
  | "cash_in_confirmed"
  | "settlement_queued"
  | "settled"
  | "settlement_failed"

export type CashInMethod = "agent_cash" | "bank_transfer" | "card"

export type CashOutStatus = "requested" | "approved" | "completed" | "failed"

export type SettlementStatus = "pending" | "processing" | "completed" | "failed"

export interface User {
  id: string
  full_name: string
  email: string
  mobile_number: string
  role: UserRole
  created_at: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  expires_at: string
  user: User
}

export interface KycStatusOut {
  status: KycStatus
  rejection_reason: string | null
  submitted_at: string | null
  reviewed_at: string | null
}

export interface KycOut {
  id: string
  user_id: string
  full_name: string
  date_of_birth: string
  nationality: string
  identification_number: string
  residential_address: string
  mobile_number: string
  email_address: string
  source_of_funds: string
  status: KycStatus
  rejection_reason: string | null
  submitted_at: string | null
  reviewed_at: string | null
}

export interface KycSubmit {
  full_name: string
  date_of_birth: string
  nationality: string
  identification_number: string
  residential_address: string
  mobile_number: string
  email_address: string
  source_of_funds: string
}

export interface LimitStatus {
  tier: string
  daily_limit_zar: string
  monthly_limit_zar: string
  used_today_zar: string
  used_this_month_zar: string
  remaining_today_zar: string
  remaining_this_month_zar: string
}

export interface Beneficiary {
  id: string
  sender_id: string
  full_name: string
  mobile_number: string | null
  email_address: string | null
  country: string
  payout_currency: string
  relationship_to_sender: string
  linked_user_id: string | null
  wallet_provisioned: boolean
  created_at: string
}

export interface BeneficiaryCreate {
  full_name: string
  mobile_number?: string
  email_address?: string
  country: string
  payout_currency: string
  relationship_to_sender: string
}

export interface Remittance {
  id: string
  tracking_ref: string
  sender_id: string
  beneficiary_id: string
  zar_amount: string
  exchange_rate: string
  fx_margin_percentage: string
  transaction_fee_zar: string
  rlusd_amount: string
  cash_out_fee_percentage: string
  estimated_cash_out_fee: string
  estimated_recipient_payout: string
  status: RemittanceStatus
  cash_in_method: CashInMethod | null
  cash_in_initiated_at: string | null
  cash_in_confirmed_at: string | null
  xrpl_settlement_tx_hash: string | null
  settled_at: string | null
  settlement_failure_reason: string | null
  expires_at: string
  created_at: string
}

export interface Wallet {
  balance_rlusd: string
  spendable_balance: string
  on_chain_balance: string
  xrpl_address: string | null
  trustline_established?: boolean
  incoming_transfers: IncomingTransfer[]
  cash_out_transactions: CashOutSummary[]
}

export interface IncomingTransfer {
  remittance_id: string
  rlusd_amount: string
  status: string
  xrpl_tx_hash: string | null
  settled_at: string | null
  created_at: string
}

export interface CashOutSummary {
  id: string
  rlusd_amount: string
  fiat_currency: string
  fiat_payout_amount: string
  status: string
  created_at: string
  completed_at: string | null
  xrpl_burn_tx_hash?: string | null
}

export interface CashOut {
  id: string
  user_id: string
  rlusd_amount: string
  fiat_currency: string
  exchange_rate: string
  cash_out_fee_percentage: string
  fee_amount_rlusd: string
  fiat_payout_amount: string
  status: CashOutStatus
  created_at: string
  actioned_at: string | null
  completed_at: string | null
  xrpl_burn_tx_hash?: string | null
}

export interface SettlementMessage {
  id: string
  remittance_id: string
  status: SettlementStatus
  attempts: number
  failure_reason: string | null
  stream_entry_id: string | null
  created_at: string
  processed_at: string | null
}

export interface FeeConfig {
  fixed_fee_zar: string
  percentage_fee: string
  fx_margin_percentage: string
  cash_out_fee_percentage: string
}

export interface LimitTier {
  tier_key: string
  daily_limit_zar: string
  monthly_limit_zar: string
}

export interface PlatformWalletStatus {
  classic_address: string
  network: string
  trustline_established: boolean
  xrp_drops: string
  uctusd_balance: string
  issuer_address: string
  currency_code: string
  currency_symbol: string
  distributor_address: string
  explorer_url: string
  liquidity_ready: boolean
}

export class ApiError extends Error {
  status: number
  detail: string

  constructor(status: number, detail: string) {
    super(detail)
    this.status = status
    this.detail = detail
  }
}
