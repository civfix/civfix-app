import {
  WebhookSignatureError,
  type AccountLink,
  type ApplicationFeeRecord,
  type ApplicationFeeRefund,
  type BalanceTransactionRecord,
  type CheckoutSessionSnapshot,
  type ConnectedAccountStatus,
  type CreateAccountLinkInput,
  type CreateConnectedAccountInput,
  type CreateDonationCheckoutInput,
  type DonationCheckoutSession,
  type DonationPaymentStatus,
  type DonationSessionStatus,
  type PaymentMethodDomainRegistration,
  type PaymentRefundRecord,
  type PaymentSnapshot,
  type Payments,
  type PaymentsListInput,
  type PaymentsMode,
  type PaymentsPage,
  type PaymentsWebhookEvent,
  type PaymentsWebhookScope,
} from "../interfaces/payments.js"
import { constantTimeEqual, hmacSha256Hex } from "./hmac.js"

export const FAKE_WEBHOOK_SECRETS: Readonly<Record<PaymentsWebhookScope, string>> = {
  connect: "whsec_fake_connect",
  platform: "whsec_fake_platform",
}

export const FAKE_PAYMENTS_CLOCK_START_MS = Date.UTC(2026, 0, 1, 0, 0, 0)
export const WEBHOOK_TOLERANCE_SEC = 300
export const CHECKOUT_MIN_TTL_SEC = 30 * 60
export const CHECKOUT_MAX_TTL_SEC = 24 * 60 * 60
const PROCESSOR_FEE_BPS = 290
const PROCESSOR_FEE_FIXED_MINOR = 30

export interface FakeRefund {
  id: string
  chargeId: string
  amountMinor: number
  status: string
  reason: string | null
  createdSec: number
}

export interface FakeCheckout {
  sessionId: string
  paymentIntentId: string
  clientSecret: string
  accountId: string
  donationId: string
  orgId: string
  amountMinor: number
  applicationFeeMinor: number
  expiresAtSec: number
  status: DonationSessionStatus
  paymentStatus: DonationPaymentStatus
  chargeId: string | null
  applicationFeeId: string | null
  stripeFeeMinor: number | null
  cardBrand: string | null
  cardLast4: string | null
  chargedAtSec: number | null
}

export interface CompleteCheckoutOptions {
  stripeFeeMinor?: number
  cardBrand?: string
  cardLast4?: string
  chargedAtSec?: number
}

export interface FakePaymentsOptions {
  now?: () => number
  mode?: PaymentsMode
  webhookSecrets?: Partial<Record<PaymentsWebhookScope, string>>
  processorFeeMinor?: (amountMinor: number) => number
}

export interface FakeRefundOptions {
  refundId?: string
  status?: string
  reason?: string | null
  createdSec?: number
}

export interface SignedWebhook {
  rawBody: string
  signatureHeader: string
}

function defaultProcessorFee(amountMinor: number): number {
  return Math.round((amountMinor * PROCESSOR_FEE_BPS) / 10000) + PROCESSOR_FEE_FIXED_MINOR
}

export const FAKE_PAYMENTS_PAGE_LIMIT = 100

function pageOf<T extends { id: string; createdSec: number }>(
  items: readonly T[],
  input: PaymentsListInput,
): PaymentsPage<T> {
  const since = input.since ?? null
  const filtered = since === null ? [...items] : items.filter((item) => item.createdSec > since)
  const cursor = input.cursor ?? null
  const start = cursor === null ? 0 : filtered.findIndex((item) => item.id === cursor) + 1
  const limit = input.limit ?? FAKE_PAYMENTS_PAGE_LIMIT
  const page = filtered.slice(start, start + limit)
  const last = page[page.length - 1]
  return {
    items: page,
    nextCursor: last !== undefined && start + page.length < filtered.length ? last.id : null,
  }
}

export class FakePayments implements Payments {
  private readonly accounts = new Map<string, ConnectedAccountStatus>()
  private readonly accountsByOrg = new Map<string, string>()
  private readonly checkouts = new Map<string, FakeCheckout>()
  private readonly checkoutsByDonation = new Map<string, string>()
  private readonly domains = new Map<string, PaymentMethodDomainRegistration>()
  private readonly refundedApplicationFeeMinor = new Map<string, number>()
  private readonly refunds: FakeRefund[] = []
  private readonly secrets: Record<PaymentsWebhookScope, string>
  private readonly clock: () => number
  private readonly processorFee: (amountMinor: number) => number
  private readonly paymentsMode: PaymentsMode
  private counter = 0

  constructor(options: FakePaymentsOptions = {}) {
    this.clock = options.now ?? (() => FAKE_PAYMENTS_CLOCK_START_MS)
    this.paymentsMode = options.mode ?? "test"
    this.secrets = {
      connect: options.webhookSecrets?.connect ?? FAKE_WEBHOOK_SECRETS.connect,
      platform: options.webhookSecrets?.platform ?? FAKE_WEBHOOK_SECRETS.platform,
    }
    this.processorFee = options.processorFeeMinor ?? defaultProcessorFee
  }

  private nextId(prefix: string): string {
    this.counter += 1
    return `${prefix}_fake_${this.counter}`
  }

  private nowSec(): number {
    return Math.floor(this.clock() / 1000)
  }

  private accountOrThrow(accountId: string): ConnectedAccountStatus {
    const account = this.accounts.get(accountId)
    if (account === undefined) throw new Error(`FakePayments: unknown connected account "${accountId}"`)
    return account
  }

  private checkoutOrThrow(sessionId: string): FakeCheckout {
    const checkout = this.checkouts.get(sessionId)
    if (checkout === undefined) throw new Error(`FakePayments: unknown checkout session "${sessionId}"`)
    return checkout
  }

  mode(): PaymentsMode {
    return this.paymentsMode
  }

  private livemode(): boolean {
    return this.paymentsMode === "live"
  }

  async createConnectedAccount(input: CreateConnectedAccountInput): Promise<ConnectedAccountStatus> {
    const requestKey = `${input.orgId}:${input.idempotencyKey}`
    const existingId = this.accountsByOrg.get(requestKey)
    if (existingId !== undefined) return this.accountOrThrow(existingId)
    const accountId = this.nextId("acct")
    const account: ConnectedAccountStatus = {
      accountId,
      livemode: this.livemode(),
      detailsSubmitted: false,
      chargesEnabled: false,
      payoutsEnabled: false,
      disabledReason: "requirements.past_due",
      currentlyDue: ["business_profile.url", "individual.verification.document"],
      pastDue: [],
      pendingVerification: [],
      futureCurrentlyDue: [],
      currentDeadlineSec: null,
      capabilities: { card_payments: "inactive", transfers: "inactive" },
    }
    this.accounts.set(accountId, account)
    this.accountsByOrg.set(requestKey, accountId)
    return account
  }

  async createAccountLink(input: CreateAccountLinkInput): Promise<AccountLink> {
    this.accountOrThrow(input.accountId)
    const token = this.nextId("acctlink")
    return {
      url: `https://connect.stripe.test/${input.type}/${input.accountId}/${token}`,
      expiresAtSec: this.nowSec() + 300,
    }
  }

  async retrieveAccount(accountId: string): Promise<ConnectedAccountStatus> {
    return this.accountOrThrow(accountId)
  }

  async registerPaymentMethodDomain(
    accountId: string,
    domain: string,
  ): Promise<PaymentMethodDomainRegistration> {
    const account = this.accountOrThrow(accountId)
    const key = `${accountId}:${domain}`
    const existing = this.domains.get(key)
    if (existing !== undefined) return existing
    const registration: PaymentMethodDomainRegistration = {
      id: this.nextId("pmd"),
      domain,
      enabled: account.chargesEnabled,
    }
    this.domains.set(key, registration)
    return registration
  }

  async createDonationCheckout(input: CreateDonationCheckoutInput): Promise<DonationCheckoutSession> {
    this.accountOrThrow(input.accountId)
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
      throw new RangeError("FakePayments: amountMinor must be a positive integer")
    }
    if (
      !Number.isSafeInteger(input.applicationFeeMinor) ||
      input.applicationFeeMinor < 0 ||
      input.applicationFeeMinor > input.amountMinor
    ) {
      throw new RangeError("FakePayments: applicationFeeMinor must be between 0 and amountMinor")
    }
    const ttlSec = input.expiresAtSec - this.nowSec()
    if (ttlSec < CHECKOUT_MIN_TTL_SEC || ttlSec > CHECKOUT_MAX_TTL_SEC) {
      throw new RangeError(
        `FakePayments: expires_at must be ${CHECKOUT_MIN_TTL_SEC}-${CHECKOUT_MAX_TTL_SEC} seconds ahead, received ${ttlSec}`,
      )
    }
    const existingId = this.checkoutsByDonation.get(input.donationId)
    if (existingId !== undefined) {
      const existing = this.checkoutOrThrow(existingId)
      return {
        sessionId: existing.sessionId,
        paymentIntentId: existing.paymentIntentId,
        clientSecret: existing.clientSecret,
        expiresAtSec: existing.expiresAtSec,
      }
    }
    const sessionId = this.nextId("cs")
    const paymentIntentId = this.nextId("pi")
    const checkout: FakeCheckout = {
      sessionId,
      paymentIntentId,
      clientSecret: `${sessionId}_secret_${this.counter}`,
      accountId: input.accountId,
      donationId: input.donationId,
      orgId: input.orgId,
      amountMinor: input.amountMinor,
      applicationFeeMinor: input.applicationFeeMinor,
      expiresAtSec: input.expiresAtSec,
      status: "open",
      paymentStatus: "unpaid",
      chargeId: null,
      applicationFeeId: null,
      stripeFeeMinor: null,
      cardBrand: null,
      cardLast4: null,
      chargedAtSec: null,
    }
    this.checkouts.set(sessionId, checkout)
    this.checkoutsByDonation.set(input.donationId, sessionId)
    return {
      sessionId,
      paymentIntentId,
      clientSecret: checkout.clientSecret,
      expiresAtSec: checkout.expiresAtSec,
    }
  }

  async retrieveCheckoutSession(
    accountId: string,
    sessionId: string,
  ): Promise<CheckoutSessionSnapshot> {
    const checkout = this.checkoutOrThrow(sessionId)
    if (checkout.accountId !== accountId) {
      throw new Error("FakePayments: checkout session does not belong to that connected account")
    }
    const expired = checkout.status === "expired" || checkout.expiresAtSec <= this.nowSec()
    const status: DonationSessionStatus =
      checkout.status === "complete" ? "complete" : expired ? "expired" : "open"
    return {
      sessionId: checkout.sessionId,
      paymentIntentId: checkout.paymentIntentId,
      clientSecret: status === "open" ? checkout.clientSecret : null,
      status,
      expiresAtSec: checkout.expiresAtSec,
    }
  }

  async retrieveDonation(accountId: string, sessionId: string): Promise<PaymentSnapshot> {
    const checkout = this.checkoutOrThrow(sessionId)
    if (checkout.accountId !== accountId) {
      throw new Error("FakePayments: checkout session does not belong to that connected account")
    }
    const netMinor =
      checkout.stripeFeeMinor === null
        ? null
        : Math.max(0, checkout.amountMinor - checkout.stripeFeeMinor - checkout.applicationFeeMinor)
    return {
      status: checkout.status,
      paymentStatus: checkout.paymentStatus,
      amountMinor: checkout.amountMinor,
      stripeFeeMinor: checkout.stripeFeeMinor,
      applicationFeeMinor: checkout.stripeFeeMinor === null ? null : checkout.applicationFeeMinor,
      netMinor,
      cardBrand: checkout.cardBrand,
      cardLast4: checkout.cardLast4,
      chargedAtSec: checkout.chargedAtSec,
      livemode: this.livemode(),
      chargeId: checkout.chargeId,
      applicationFeeId: checkout.applicationFeeId,
    }
  }

  async listRefunds(accountId: string, chargeId: string): Promise<PaymentRefundRecord[]> {
    this.accountOrThrow(accountId)
    return this.refunds
      .filter((refund) => refund.chargeId === chargeId)
      .map((refund) => ({
        id: refund.id,
        amountMinor: refund.amountMinor,
        status: refund.status,
        reason: refund.reason,
        createdSec: refund.createdSec,
      }))
  }

  async listBalanceTransactions(
    accountId: string,
    input: PaymentsListInput,
  ): Promise<PaymentsPage<BalanceTransactionRecord>> {
    this.accountOrThrow(accountId)
    const settled = [...this.checkouts.values()]
      .filter(
        (checkout) =>
          checkout.accountId === accountId &&
          checkout.chargedAtSec !== null &&
          checkout.stripeFeeMinor !== null,
      )
      .sort((a, b) => (a.chargedAtSec ?? 0) - (b.chargedAtSec ?? 0))
      .map((checkout) => this.balanceTransactionOf(checkout))
    return pageOf(settled, input)
  }

  async listApplicationFees(input: PaymentsListInput): Promise<PaymentsPage<ApplicationFeeRecord>> {
    const fees = [...this.checkouts.values()]
      .filter((checkout) => checkout.applicationFeeId !== null && checkout.chargedAtSec !== null)
      .sort((a, b) => (a.chargedAtSec ?? 0) - (b.chargedAtSec ?? 0))
      .map((checkout) => ({
        id: checkout.applicationFeeId as string,
        chargeId: checkout.chargeId,
        amountMinor: checkout.applicationFeeMinor,
        amountRefundedMinor: this.refundedApplicationFeeMinor.get(
          checkout.applicationFeeId as string,
        ) ?? 0,
        currency: "usd",
        createdSec: checkout.chargedAtSec as number,
        livemode: this.livemode(),
      }))
    return pageOf(fees, input)
  }

  private balanceTransactionOf(checkout: FakeCheckout): BalanceTransactionRecord {
    const stripeFeeMinor = checkout.stripeFeeMinor ?? 0
    const applicationFeeMinor = checkout.applicationFeeMinor
    return {
      id: `txn_for_${checkout.chargeId ?? checkout.sessionId}`,
      type: "charge",
      amountMinor: checkout.amountMinor,
      feeMinor: stripeFeeMinor + applicationFeeMinor,
      stripeFeeMinor,
      applicationFeeMinor,
      netMinor: checkout.amountMinor - stripeFeeMinor - applicationFeeMinor,
      currency: "usd",
      createdSec: checkout.chargedAtSec as number,
      sourceId: checkout.chargeId,
    }
  }

  async refundApplicationFee(
    applicationFeeId: string,
    amountMinor: number,
    _idempotencyKey: string,
  ): Promise<ApplicationFeeRefund> {
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
      throw new RangeError("FakePayments: refund amountMinor must be a non-negative integer")
    }
    const already = this.refundedApplicationFeeMinor.get(applicationFeeId) ?? 0
    if (amountMinor === 0) {
      return { id: this.nextId("fr"), amountMinor: 0, status: "skipped" }
    }
    this.refundedApplicationFeeMinor.set(applicationFeeId, already + amountMinor)
    return { id: this.nextId("fr"), amountMinor, status: "succeeded" }
  }

  verifyWebhookSignature(
    rawBody: string | Uint8Array,
    signatureHeader: string,
    scope: PaymentsWebhookScope,
  ): PaymentsWebhookEvent {
    const body = typeof rawBody === "string" ? rawBody : new TextDecoder().decode(rawBody)
    let timestamp: string | null = null
    const signatures: string[] = []
    for (const part of signatureHeader.split(",")) {
      const separator = part.indexOf("=")
      if (separator === -1) continue
      const key = part.slice(0, separator).trim()
      const value = part.slice(separator + 1).trim()
      if (key === "t" && timestamp === null) timestamp = value
      else if (key === "v1") signatures.push(value)
    }
    if (timestamp === null || signatures.length === 0) {
      throw new WebhookSignatureError(scope, "missing t or v1 in the signature header")
    }
    const timestampSec = Number(timestamp)
    if (!Number.isFinite(timestampSec)) {
      throw new WebhookSignatureError(scope, "signature timestamp is not a number")
    }
    if (Math.abs(this.nowSec() - timestampSec) > WEBHOOK_TOLERANCE_SEC) {
      throw new WebhookSignatureError(scope, "signature timestamp is outside the tolerance window")
    }
    const expected = hmacSha256Hex(this.secrets[scope], `${timestamp}.${body}`)
    if (!signatures.some((candidate) => constantTimeEqual(candidate, expected))) {
      throw new WebhookSignatureError(scope, "no v1 signature matched")
    }

    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(body) as Record<string, unknown>
    } catch {
      throw new WebhookSignatureError(scope, "signed body is not valid JSON")
    }
    const account = typeof payload.account === "string" ? payload.account : null
    const data = (payload.data ?? {}) as { object?: Record<string, unknown> }
    return {
      id: typeof payload.id === "string" ? payload.id : this.nextId("evt"),
      type: typeof payload.type === "string" ? payload.type : "unknown",
      scope,
      accountId: account,
      livemode: payload.livemode === true,
      apiVersion: typeof payload.api_version === "string" ? payload.api_version : null,
      createdSec: typeof payload.created === "number" ? payload.created : timestampSec,
      data: { object: data.object ?? {} },
    }
  }

  signWebhook(payload: Record<string, unknown>, scope: PaymentsWebhookScope): SignedWebhook {
    const rawBody = JSON.stringify(payload)
    const timestamp = this.nowSec()
    const signature = hmacSha256Hex(this.secrets[scope], `${timestamp}.${rawBody}`)
    return { rawBody, signatureHeader: `t=${timestamp},v1=${signature}` }
  }

  settleAccount(accountId: string, patch: Partial<ConnectedAccountStatus> = {}): ConnectedAccountStatus {
    const account = this.accountOrThrow(accountId)
    const settled: ConnectedAccountStatus = {
      ...account,
      detailsSubmitted: true,
      chargesEnabled: true,
      payoutsEnabled: true,
      disabledReason: null,
      currentlyDue: [],
      pastDue: [],
      pendingVerification: [],
      futureCurrentlyDue: [],
      currentDeadlineSec: null,
      capabilities: { card_payments: "active", transfers: "active" },
      ...patch,
      accountId,
    }
    this.accounts.set(accountId, settled)
    return settled
  }

  completeCheckout(sessionId: string, options: CompleteCheckoutOptions = {}): FakeCheckout {
    const checkout = this.checkoutOrThrow(sessionId)
    if (checkout.status === "expired") throw new Error("FakePayments: cannot complete an expired session")
    checkout.status = "complete"
    checkout.paymentStatus = "paid"
    checkout.chargeId = checkout.chargeId ?? this.nextId("ch")
    checkout.applicationFeeId =
      checkout.applicationFeeMinor > 0 ? (checkout.applicationFeeId ?? this.nextId("fee")) : null
    checkout.stripeFeeMinor = options.stripeFeeMinor ?? this.processorFee(checkout.amountMinor)
    checkout.cardBrand = options.cardBrand ?? "visa"
    checkout.cardLast4 = options.cardLast4 ?? "4242"
    checkout.chargedAtSec = options.chargedAtSec ?? this.nowSec()
    return checkout
  }

  refundCheckout(
    sessionId: string,
    amountMinor: number,
    options: FakeRefundOptions = {},
  ): FakeRefund {
    const checkout = this.checkoutOrThrow(sessionId)
    if (checkout.chargeId === null) {
      throw new Error("FakePayments: cannot refund a session that was never charged")
    }
    const refund: FakeRefund = {
      id: options.refundId ?? this.nextId("re"),
      chargeId: checkout.chargeId,
      amountMinor,
      status: options.status ?? "succeeded",
      reason: options.reason ?? null,
      createdSec: options.createdSec ?? this.nowSec(),
    }
    this.refunds.push(refund)
    return refund
  }

  setRefundStatus(refundId: string, status: string): FakeRefund {
    const refund = this.refunds.find((entry) => entry.id === refundId)
    if (refund === undefined) throw new Error(`FakePayments: unknown refund "${refundId}"`)
    refund.status = status
    return refund
  }

  expireCheckout(sessionId: string): FakeCheckout {
    const checkout = this.checkoutOrThrow(sessionId)
    if (checkout.status === "complete") throw new Error("FakePayments: cannot expire a completed session")
    checkout.status = "expired"
    checkout.paymentStatus = "unpaid"
    return checkout
  }

  checkoutFor(donationId: string): FakeCheckout | undefined {
    const sessionId = this.checkoutsByDonation.get(donationId)
    return sessionId === undefined ? undefined : this.checkouts.get(sessionId)
  }

  reset(): void {
    this.accounts.clear()
    this.accountsByOrg.clear()
    this.checkouts.clear()
    this.checkoutsByDonation.clear()
    this.domains.clear()
    this.refundedApplicationFeeMinor.clear()
    this.refunds.length = 0
    this.counter = 0
  }
}
