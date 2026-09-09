import { beforeEach, describe, expect, it } from "vitest"
import { WebhookSignatureError } from "../../interfaces/payments.js"
import {
  FAKE_PAYMENTS_CLOCK_START_MS,
  FAKE_WEBHOOK_SECRETS,
  FakePayments,
  WEBHOOK_TOLERANCE_SEC,
} from "../payments.fake.js"
import { hmacSha256Hex } from "../hmac.js"

const ACCOUNT_INPUT = {
  orgId: "org-1",
  email: "ops@example.org",
  legalName: "Example Org",
  idempotencyKey: "acct:org-1:v1",
}

function checkoutInput(accountId: string) {
  return {
    accountId,
    donationId: "don-1",
    orgId: "org-1",
    amountMinor: 5000,
    currency: "usd" as const,
    productName: "Donation to Example Org",
    applicationFeeMinor: 250,
    expiresAtSec: Math.floor(FAKE_PAYMENTS_CLOCK_START_MS / 1000) + 1800,
    idempotencyKey: "donation:don-1:checkout:v1",
  }
}

describe("FakePayments determinism", () => {
  it("mints the same ids from a fresh instance and never reads the wall clock", () => {
    const first = new FakePayments()
    const second = new FakePayments()
    return Promise.all([
      first.createConnectedAccount(ACCOUNT_INPUT),
      second.createConnectedAccount(ACCOUNT_INPUT),
    ]).then(([a, b]) => {
      expect(a.accountId).toBe("acct_fake_1")
      expect(b.accountId).toBe(a.accountId)
      expect(a.livemode).toBe(false)
    })
  })

  it("resets back to the initial state", async () => {
    const payments = new FakePayments()
    await payments.createConnectedAccount(ACCOUNT_INPUT)
    payments.reset()
    const again = await payments.createConnectedAccount(ACCOUNT_INPUT)
    expect(again.accountId).toBe("acct_fake_1")
  })
})

describe("FakePayments connected accounts", () => {
  let payments: FakePayments

  beforeEach(() => {
    payments = new FakePayments()
  })

  it("starts an account blocked and replays the same one for the same idempotency key", async () => {
    const created = await payments.createConnectedAccount(ACCOUNT_INPUT)
    expect(created.chargesEnabled).toBe(false)
    expect(created.disabledReason).toBe("requirements.past_due")
    expect(created.currentlyDue.length).toBeGreaterThan(0)
    const again = await payments.createConnectedAccount(ACCOUNT_INPUT)
    expect(again.accountId).toBe(created.accountId)
  })

  it("mints a NEW account for a new idempotency key, as Stripe does on reconnect", async () => {
    const created = await payments.createConnectedAccount(ACCOUNT_INPUT)
    const replacement = await payments.createConnectedAccount({
      ...ACCOUNT_INPUT,
      idempotencyKey: "acct:org-1:v2:1",
    })
    expect(replacement.accountId).not.toBe(created.accountId)
  })

  it("settleAccount flips it to a ready state", async () => {
    const created = await payments.createConnectedAccount(ACCOUNT_INPUT)
    const settled = payments.settleAccount(created.accountId)
    expect(settled).toMatchObject({
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
      disabledReason: null,
      currentlyDue: [],
    })
    expect(await payments.retrieveAccount(created.accountId)).toEqual(settled)
  })

  it("settleAccount can express the at-risk and blocked shapes", async () => {
    const created = await payments.createConnectedAccount(ACCOUNT_INPUT)
    const atRisk = payments.settleAccount(created.accountId, {
      currentlyDue: ["individual.id_number"],
      currentDeadlineSec: 1800000000,
    })
    expect(atRisk.chargesEnabled).toBe(true)
    expect(atRisk.currentlyDue).toEqual(["individual.id_number"])
    const blocked = payments.settleAccount(created.accountId, {
      chargesEnabled: false,
      disabledReason: "rejected.fraud",
    })
    expect(blocked.disabledReason).toBe("rejected.fraud")
  })

  it("issues account links and registers payment method domains", async () => {
    const created = await payments.createConnectedAccount(ACCOUNT_INPUT)
    const link = await payments.createAccountLink({
      accountId: created.accountId,
      type: "onboarding",
      refreshUrl: "https://civfix.org/manage/orgs/1/payments?stripe=refresh",
      returnUrl: "https://civfix.org/manage/orgs/1/payments?stripe=return",
    })
    expect(link.url.startsWith("https://connect.stripe.test/onboarding/")).toBe(true)
    expect(link.expiresAtSec).toBe(Math.floor(FAKE_PAYMENTS_CLOCK_START_MS / 1000) + 300)

    const pending = await payments.registerPaymentMethodDomain(created.accountId, "civfix.org")
    expect(pending.enabled).toBe(false)
    payments.settleAccount(created.accountId)
    const repeat = await payments.registerPaymentMethodDomain(created.accountId, "civfix.org")
    expect(repeat.id).toBe(pending.id)
  })

  it("refuses to act on an unknown account", async () => {
    await expect(payments.retrieveAccount("acct_nope")).rejects.toThrow(/unknown connected account/)
  })
})

describe("FakePayments checkout lifecycle", () => {
  let payments: FakePayments
  let accountId: string

  beforeEach(async () => {
    payments = new FakePayments()
    const account = await payments.createConnectedAccount(ACCOUNT_INPUT)
    accountId = account.accountId
    payments.settleAccount(accountId)
  })

  it("creates a session and replays the same one for a repeated donation", async () => {
    const session = await payments.createDonationCheckout(checkoutInput(accountId))
    expect(session.sessionId).toMatch(/^cs_fake_\d+$/)
    expect(session.paymentIntentId).toMatch(/^pi_fake_\d+$/)
    expect(session.clientSecret.startsWith(session.sessionId)).toBe(true)
    const replay = await payments.createDonationCheckout(checkoutInput(accountId))
    expect(replay).toEqual(session)
  })

  it("rejects an invalid amount or an application fee above the amount", async () => {
    await expect(
      payments.createDonationCheckout({ ...checkoutInput(accountId), amountMinor: 0 }),
    ).rejects.toThrow(/amountMinor/)
    await expect(
      payments.createDonationCheckout({
        ...checkoutInput(accountId),
        applicationFeeMinor: 99999,
      }),
    ).rejects.toThrow(/applicationFeeMinor/)
  })

  it("reports an open session as unpaid until it is completed", async () => {
    const session = await payments.createDonationCheckout(checkoutInput(accountId))
    const open = await payments.retrieveDonation(accountId, session.sessionId)
    expect(open).toMatchObject({ status: "open", paymentStatus: "unpaid", chargeId: null, netMinor: null })

    payments.completeCheckout(session.sessionId)
    const paid = await payments.retrieveDonation(accountId, session.sessionId)
    expect(paid.status).toBe("complete")
    expect(paid.paymentStatus).toBe("paid")
    expect(paid.stripeFeeMinor).toBe(175)
    expect(paid.netMinor).toBe(5000 - 175 - 250)
    expect(paid.cardLast4).toBe("4242")
    expect(paid.chargeId).toMatch(/^ch_fake_\d+$/)
    expect(paid.applicationFeeId).toMatch(/^fee_fake_\d+$/)
    expect(paid.chargedAtSec).toBe(Math.floor(FAKE_PAYMENTS_CLOCK_START_MS / 1000))
  })

  it("completing twice is idempotent on the charge id", async () => {
    const session = await payments.createDonationCheckout(checkoutInput(accountId))
    const first = payments.completeCheckout(session.sessionId)
    const second = payments.completeCheckout(session.sessionId)
    expect(second.chargeId).toBe(first.chargeId)
    expect(second.applicationFeeId).toBe(first.applicationFeeId)
  })

  it("omits the application fee object when the fee is zero", async () => {
    const session = await payments.createDonationCheckout({
      ...checkoutInput(accountId),
      applicationFeeMinor: 0,
    })
    payments.completeCheckout(session.sessionId)
    const snapshot = await payments.retrieveDonation(accountId, session.sessionId)
    expect(snapshot.applicationFeeId).toBeNull()
  })

  it("expires an open session and refuses contradictory transitions", async () => {
    const session = await payments.createDonationCheckout(checkoutInput(accountId))
    payments.expireCheckout(session.sessionId)
    const snapshot = await payments.retrieveDonation(accountId, session.sessionId)
    expect(snapshot.status).toBe("expired")
    expect(snapshot.paymentStatus).toBe("unpaid")
    expect(() => payments.completeCheckout(session.sessionId)).toThrow(/expired/)
  })

  it("returns the live client secret of an open session and withholds it once it is not", async () => {
    const session = await payments.createDonationCheckout(checkoutInput(accountId))
    const open = await payments.retrieveCheckoutSession(accountId, session.sessionId)
    expect(open.status).toBe("open")
    expect(open.clientSecret).toBe(session.clientSecret)
    expect(open.paymentIntentId).toBe(session.paymentIntentId)

    payments.expireCheckout(session.sessionId)
    const expired = await payments.retrieveCheckoutSession(accountId, session.sessionId)
    expect(expired.status).toBe("expired")
    expect(expired.clientSecret).toBeNull()
  })

  it("refuses to read a session across connected accounts", async () => {
    const session = await payments.createDonationCheckout(checkoutInput(accountId))
    const other = await payments.createConnectedAccount({ ...ACCOUNT_INPUT, orgId: "org-2" })
    await expect(payments.retrieveDonation(other.accountId, session.sessionId)).rejects.toThrow(
      /does not belong/,
    )
  })

  it("refunds the application fee once and reports a zero refund as skipped", async () => {
    const refund = await payments.refundApplicationFee("fee_fake_1", 100, "appfeerefund:1:v1")
    expect(refund).toMatchObject({ amountMinor: 100, status: "succeeded" })
    const skipped = await payments.refundApplicationFee("fee_fake_1", 0, "appfeerefund:1:v2")
    expect(skipped.status).toBe("skipped")
    await expect(payments.refundApplicationFee("fee_fake_1", -1, "k")).rejects.toThrow(RangeError)
  })
})

describe("FakePayments webhook signatures", () => {
  const payload = { id: "evt_1", type: "checkout.session.completed", data: { object: { id: "cs_1" } } }
  let clockMs: number
  let payments: FakePayments

  beforeEach(() => {
    clockMs = FAKE_PAYMENTS_CLOCK_START_MS
    payments = new FakePayments({ now: () => clockMs })
  })

  it("signs with a real HMAC-SHA256 over `${t}.${raw}`", () => {
    const signed = payments.signWebhook(payload, "connect")
    const timestamp = signed.signatureHeader.split(",")[0]?.slice(2) as string
    const expected = hmacSha256Hex(FAKE_WEBHOOK_SECRETS.connect, `${timestamp}.${signed.rawBody}`)
    expect(signed.signatureHeader).toBe(`t=${timestamp},v1=${expected}`)
  })

  it("verifies a freshly signed event and carries the scope through", () => {
    const signed = payments.signWebhook({ ...payload, account: "acct_fake_1" }, "connect")
    const event = payments.verifyWebhookSignature(signed.rawBody, signed.signatureHeader, "connect")
    expect(event).toMatchObject({
      id: "evt_1",
      type: "checkout.session.completed",
      scope: "connect",
      accountId: "acct_fake_1",
      livemode: false,
    })
    expect(event.data.object).toEqual({ id: "cs_1" })
  })

  it("accepts a raw Uint8Array body", () => {
    const signed = payments.signWebhook(payload, "platform")
    const bytes = new TextEncoder().encode(signed.rawBody)
    expect(payments.verifyWebhookSignature(bytes, signed.signatureHeader, "platform").id).toBe("evt_1")
  })

  it("rejects a signature minted for the other scope", () => {
    const signed = payments.signWebhook(payload, "connect")
    expect(() => payments.verifyWebhookSignature(signed.rawBody, signed.signatureHeader, "platform")).toThrow(
      WebhookSignatureError,
    )
  })

  it("rejects a tampered body and a forged signature", () => {
    const signed = payments.signWebhook(payload, "connect")
    expect(() =>
      payments.verifyWebhookSignature(`${signed.rawBody} `, signed.signatureHeader, "connect"),
    ).toThrow(WebhookSignatureError)
    const forged = signed.signatureHeader.replace(/v1=.*/u, `v1=${"0".repeat(64)}`)
    expect(() => payments.verifyWebhookSignature(signed.rawBody, forged, "connect")).toThrow(
      WebhookSignatureError,
    )
  })

  it("accepts a v1 among several during a secret roll and ignores v0", () => {
    const signed = payments.signWebhook(payload, "connect")
    const withNoise = `${signed.signatureHeader},v1=${"a".repeat(64)},v0=${"b".repeat(64)}`
    expect(payments.verifyWebhookSignature(signed.rawBody, withNoise, "connect").id).toBe("evt_1")
  })

  it("rejects a v0-only header and a header with no timestamp", () => {
    const signed = payments.signWebhook(payload, "connect")
    const v0Only = signed.signatureHeader.replace("v1=", "v0=")
    expect(() => payments.verifyWebhookSignature(signed.rawBody, v0Only, "connect")).toThrow(
      WebhookSignatureError,
    )
    const noTimestamp = signed.signatureHeader.split(",").slice(1).join(",")
    expect(() => payments.verifyWebhookSignature(signed.rawBody, noTimestamp, "connect")).toThrow(
      WebhookSignatureError,
    )
    expect(() => payments.verifyWebhookSignature(signed.rawBody, "garbage", "connect")).toThrow(
      WebhookSignatureError,
    )
  })

  it("enforces the 300 second tolerance in both directions", () => {
    expect(WEBHOOK_TOLERANCE_SEC).toBe(300)
    const signed = payments.signWebhook(payload, "connect")
    clockMs += WEBHOOK_TOLERANCE_SEC * 1000
    expect(payments.verifyWebhookSignature(signed.rawBody, signed.signatureHeader, "connect").id).toBe(
      "evt_1",
    )
    clockMs += 1000
    expect(() => payments.verifyWebhookSignature(signed.rawBody, signed.signatureHeader, "connect")).toThrow(
      /tolerance/,
    )
    clockMs = FAKE_PAYMENTS_CLOCK_START_MS - (WEBHOOK_TOLERANCE_SEC + 1) * 1000
    expect(() => payments.verifyWebhookSignature(signed.rawBody, signed.signatureHeader, "connect")).toThrow(
      /tolerance/,
    )
  })

  it("honours injected webhook secrets", () => {
    const custom = new FakePayments({ now: () => clockMs, webhookSecrets: { connect: "whsec_other" } })
    const signed = custom.signWebhook(payload, "connect")
    expect(signed.signatureHeader).not.toBe(payments.signWebhook(payload, "connect").signatureHeader)
    expect(custom.verifyWebhookSignature(signed.rawBody, signed.signatureHeader, "connect").id).toBe(
      "evt_1",
    )
    expect(() => payments.verifyWebhookSignature(signed.rawBody, signed.signatureHeader, "connect")).toThrow(
      WebhookSignatureError,
    )
  })

  it("rejects a correctly signed body that is not JSON", () => {
    const timestamp = Math.floor(clockMs / 1000)
    const rawBody = "not json"
    const signature = hmacSha256Hex(FAKE_WEBHOOK_SECRETS.connect, `${timestamp}.${rawBody}`)
    expect(() =>
      payments.verifyWebhookSignature(rawBody, `t=${timestamp},v1=${signature}`, "connect"),
    ).toThrow(/JSON/)
  })
})
