export type PaymentsWebhookScope = "connect" | "platform"

export type AccountLinkKind = "onboarding" | "update"

export type PaymentsMode = "live" | "test"

export interface CreateConnectedAccountInput {
  orgId: string
  email?: string
  legalName: string
  url?: string
  statementDescriptorHint?: string
  idempotencyKey: string
}

export interface ConnectedAccountStatus {
  accountId: string
  livemode: boolean
  detailsSubmitted: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
  disabledReason: string | null
  currentlyDue: string[]
  pastDue: string[]
  pendingVerification: string[]
  futureCurrentlyDue: string[]
  currentDeadlineSec: number | null
  capabilities: Record<string, string>
}

export interface CreateAccountLinkInput {
  accountId: string
  type: AccountLinkKind
  refreshUrl: string
  returnUrl: string
}

export interface AccountLink {
  url: string
  expiresAtSec: number
}

export interface PaymentMethodDomainRegistration {
  id: string
  domain: string
  enabled: boolean
}

export interface CreateDonationCheckoutInput {
  accountId: string
  donationId: string
  orgId: string
  amountMinor: number
  currency: "usd"
  productName: string
  customerEmail?: string
  applicationFeeMinor: number
  expiresAtSec: number
  idempotencyKey: string
}

export interface DonationCheckoutSession {
  sessionId: string
  paymentIntentId: string
  clientSecret: string
  expiresAtSec: number
}

export type DonationSessionStatus = "open" | "complete" | "expired"

export interface CheckoutSessionSnapshot {
  sessionId: string
  paymentIntentId: string | null
  clientSecret: string | null
  status: DonationSessionStatus
  expiresAtSec: number | null
}

export type DonationPaymentStatus = "paid" | "unpaid" | "no_payment_required"

export interface PaymentSnapshot {
  status: DonationSessionStatus
  paymentStatus: DonationPaymentStatus
  amountMinor: number
  stripeFeeMinor: number | null
  applicationFeeMinor: number | null
  netMinor: number | null
  cardBrand: string | null
  cardLast4: string | null
  chargedAtSec: number | null
  livemode: boolean
  chargeId: string | null
  applicationFeeId: string | null
}

export interface ApplicationFeeRefund {
  id: string
  amountMinor: number
  status: "succeeded" | "skipped"
}

export interface PaymentRefundRecord {
  id: string
  amountMinor: number
  status: string
  reason: string | null
  createdSec: number | null
}

export interface PaymentsListInput {
  since?: number | null
  cursor?: string | null
  limit?: number
}

export interface PaymentsPage<T> {
  items: T[]
  nextCursor: string | null
}

export interface BalanceTransactionRecord {
  id: string
  type: string
  amountMinor: number
  feeMinor: number
  stripeFeeMinor: number
  applicationFeeMinor: number
  netMinor: number
  currency: string
  createdSec: number
  sourceId: string | null
}

export interface ApplicationFeeRecord {
  id: string
  chargeId: string | null
  amountMinor: number
  amountRefundedMinor: number
  currency: string
  createdSec: number
  livemode: boolean
}

export interface AccountBalance {
  availableMinor: number
  pendingMinor: number
  currency: string
  payoutsEnabled: boolean
  payoutSchedule: PayoutSchedule | null
}

export type PayoutInterval = "daily" | "weekly" | "monthly" | "manual"

export interface PayoutSchedule {
  interval: PayoutInterval
  delayDays?: number
}

export type PayoutRecordStatus = "pending" | "in_transit" | "paid" | "failed" | "canceled"

export interface PayoutRecord {
  id: string
  amountMinor: number
  currency: string
  status: PayoutRecordStatus
  arrivalDateSec: number | null
  createdSec: number
  failureMessage: string | null
}

export interface CreatePayoutInput {
  amountMinor: number
  currency: string
  idempotencyKey: string
}

export interface ListPayoutsInput {
  limit?: number
  startingAfter?: string | null
}

export interface PaymentsWebhookEvent {
  id: string
  type: string
  scope: PaymentsWebhookScope
  accountId: string | null
  livemode: boolean
  apiVersion: string | null
  createdSec: number
  data: { object: Record<string, unknown> }
}

export class WebhookSignatureError extends Error {
  readonly scope: PaymentsWebhookScope

  constructor(scope: PaymentsWebhookScope, message: string) {
    super(message)
    this.name = "WebhookSignatureError"
    this.scope = scope
  }
}

export interface Payments {
  mode(): PaymentsMode
  createConnectedAccount(input: CreateConnectedAccountInput): Promise<ConnectedAccountStatus>
  createAccountLink(input: CreateAccountLinkInput): Promise<AccountLink>
  retrieveAccount(accountId: string): Promise<ConnectedAccountStatus>
  registerPaymentMethodDomain(
    accountId: string,
    domain: string,
  ): Promise<PaymentMethodDomainRegistration>
  createDonationCheckout(input: CreateDonationCheckoutInput): Promise<DonationCheckoutSession>
  retrieveCheckoutSession(accountId: string, sessionId: string): Promise<CheckoutSessionSnapshot>
  retrieveDonation(accountId: string, sessionId: string): Promise<PaymentSnapshot>
  listRefunds(accountId: string, chargeId: string): Promise<PaymentRefundRecord[]>
  listBalanceTransactions(
    accountId: string,
    input: PaymentsListInput,
  ): Promise<PaymentsPage<BalanceTransactionRecord>>
  listApplicationFees(input: PaymentsListInput): Promise<PaymentsPage<ApplicationFeeRecord>>
  refundApplicationFee(
    applicationFeeId: string,
    amountMinor: number,
    idempotencyKey: string,
  ): Promise<ApplicationFeeRefund>
  retrieveBalance(accountId: string): Promise<AccountBalance>
  createPayout(accountId: string, input: CreatePayoutInput): Promise<PayoutRecord>
  listPayouts(accountId: string, input: ListPayoutsInput): Promise<PaymentsPage<PayoutRecord>>
  verifyWebhookSignature(
    rawBody: string | Uint8Array,
    signatureHeader: string,
    scope: PaymentsWebhookScope,
  ): PaymentsWebhookEvent
}
