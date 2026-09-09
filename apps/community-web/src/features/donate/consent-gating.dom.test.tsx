import * as React from "react"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CHECKOUT, PAGE } from "./donate-fixture"

const getPublicOrgDonationPage = vi.fn()
const createDonationCheckout = vi.fn()

vi.mock("@/lib/api", () => ({
  api: {
    getPublicOrgDonationPage: (...args: unknown[]) => getPublicOrgDonationPage(...args),
    createDonationCheckout: (...args: unknown[]) => createDonationCheckout(...args),
  },
  toAppError: (error: unknown) => (error === null ? { code: "INTERNAL" } : error),
}))

vi.mock("@/lib/stripe-js", () => ({
  STRIPE_PUBLISHABLE_KEY: "pk_test_123",
  loadStripeForAccount: () => Promise.resolve({}),
}))

vi.mock("@/lib/turnstile", () => ({
  TURNSTILE_SITEKEY: undefined,
  TURNSTILE_ACTION_DONATE: "donate",
  runTurnstile: () => Promise.resolve(""),
}))

vi.mock("@/store/auth-store", () => ({
  useAuthStore: (selector: (store: unknown) => unknown) =>
    selector({ status: "anonymous", user: null }),
}))

vi.mock("./payment-panel", () => ({
  PaymentPanel: ({ recipientLegalName }: { recipientLegalName: string }) => (
    <section>
      <button type="button" data-testid="donate-pay">
        Donate to {recipientLegalName}
      </button>
    </section>
  ),
}))

const { DonateView } = await import("./donate-view")

function setPath(pathname: string): void {
  window.history.replaceState(null, "", pathname)
}

async function renderForm() {
  setPath("/donate/reach-out-la/")
  render(<DonateView />)
  await screen.findByRole("heading", { name: /Donate to Reach Out LA/i })
}

beforeEach(() => {
  getPublicOrgDonationPage.mockReset().mockResolvedValue(PAGE)
  createDonationCheckout.mockReset().mockResolvedValue(CHECKOUT)
  window.sessionStorage.clear()
})

afterEach(() => {
  cleanup()
})

function checkbox(name: RegExp): HTMLInputElement {
  return screen.getByLabelText(name) as HTMLInputElement
}

function continueButton(): HTMLButtonElement {
  return screen.getByTestId("donate-continue") as HTMLButtonElement
}

describe("consent gating", () => {
  it("starts with BOTH checkboxes unchecked, as clickwrap assent requires", async () => {
    await renderForm()
    expect(checkbox(/I have read the statements above/i).checked).toBe(false)
    expect(checkbox(/Share my name and email with Reach Out Los Angeles/i).checked).toBe(false)
  })

  it("keeps Continue disabled until the terms box is ticked", async () => {
    const user = userEvent.setup()
    await renderForm()
    await user.type(screen.getByLabelText(/Email address/i), "donor@example.org")
    expect(continueButton().disabled).toBe(true)
    await user.click(screen.getByLabelText(/I have read the statements above/i))
    expect(continueButton().disabled).toBe(false)
  })

  it("keeps Continue disabled without a deliverable email address", async () => {
    const user = userEvent.setup()
    await renderForm()
    await user.click(screen.getByLabelText(/I have read the statements above/i))
    expect(continueButton().disabled).toBe(true)
    await user.type(screen.getByLabelText(/Email address/i), "not-an-email")
    expect(continueButton().disabled).toBe(true)
  })

  it("keeps Continue disabled below the organization's own minimum", async () => {
    const user = userEvent.setup()
    await renderForm()
    await user.click(screen.getByLabelText(/I have read the statements above/i))
    await user.type(screen.getByLabelText(/Email address/i), "donor@example.org")
    const amount = screen.getByLabelText(/Amount in US dollars/i)
    await user.clear(amount)
    await user.type(amount, "1")
    expect(continueButton().disabled).toBe(true)
  })

  it("sends shareIdentity false unless the donor opted in, and true when they did", async () => {
    const user = userEvent.setup()
    await renderForm()
    await user.click(screen.getByLabelText(/I have read the statements above/i))
    await user.type(screen.getByLabelText(/Email address/i), "donor@example.org")
    await user.click(screen.getByTestId("donate-continue"))
    await screen.findByTestId("donate-pay")
    expect(createDonationCheckout.mock.calls[0]?.[0]).toMatchObject({ shareIdentity: false })

    cleanup()
    createDonationCheckout.mockClear()
    await renderForm()
    await user.click(screen.getByLabelText(/I have read the statements above/i))
    await user.click(screen.getByLabelText(/Share my name and email/i))
    await user.type(screen.getByLabelText(/Email address/i), "donor@example.org")
    await user.click(screen.getByTestId("donate-continue"))
    await screen.findByTestId("donate-pay")
    expect(createDonationCheckout.mock.calls[0]?.[0]).toMatchObject({ shareIdentity: true })
  })

  it("records which document versions the donor was shown", async () => {
    const user = userEvent.setup()
    await renderForm()
    await user.click(screen.getByLabelText(/I have read the statements above/i))
    await user.type(screen.getByLabelText(/Email address/i), "donor@example.org")
    await user.click(screen.getByTestId("donate-continue"))
    await screen.findByTestId("donate-pay")
    const consent = createDonationCheckout.mock.calls[0]?.[0]?.consent
    expect(consent).toMatchObject({
      disclosureVersion: PAGE.disclosureVersion,
      surface: "web_donate",
      screenRoute: "/donate/reach-out-la",
    })
    expect(consent.termsVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(consent.privacyVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(consent.donationTermsVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(consent.acceptedAt).toBeUndefined()
  })

  it("keeps one stable idempotency key for one attempt", async () => {
    const user = userEvent.setup()
    await renderForm()
    await user.click(screen.getByLabelText(/I have read the statements above/i))
    await user.type(screen.getByLabelText(/Email address/i), "donor@example.org")
    await user.click(screen.getByTestId("donate-continue"))
    await screen.findByTestId("donate-pay")
    expect(createDonationCheckout).toHaveBeenCalledTimes(1)
    expect(createDonationCheckout.mock.calls[0]?.[0]?.idempotencyKey.length).toBeGreaterThan(7)
  })

  it("stores the status token so a reload of the confirmation page still reads status", async () => {
    const user = userEvent.setup()
    await renderForm()
    await user.click(screen.getByLabelText(/I have read the statements above/i))
    await user.type(screen.getByLabelText(/Email address/i), "donor@example.org")
    await user.click(screen.getByTestId("donate-continue"))
    await screen.findByTestId("donate-pay")
    expect(window.sessionStorage.getItem("civfix.donate.status.don_1")).toBe(CHECKOUT.statusToken)
  })
})

describe("states that must never show a payment form", () => {
  it("renders the unavailable state when donations are blocked", async () => {
    getPublicOrgDonationPage.mockResolvedValue({ ...PAGE, donateState: "BLOCKED" })
    setPath("/donate/reach-out-la/")
    render(<DonateView />)
    await screen.findByText(/Donations are temporarily unavailable/i)
    expect(screen.queryByTestId("donate-continue")).toBe(null)
  })

  it("renders the unavailable state when the org is unknown", async () => {
    getPublicOrgDonationPage.mockRejectedValue({ code: "NOT_FOUND" })
    setPath("/donate/nope/")
    render(<DonateView />)
    await screen.findByText(/We couldn't find that organization/i)
    expect(screen.queryByTestId("donate-continue")).toBe(null)
  })

  it("renders an offline state, not a broken form, when civfix is unreachable", async () => {
    getPublicOrgDonationPage.mockRejectedValue({ code: "INTERNAL" })
    setPath("/donate/reach-out-la/")
    render(<DonateView />)
    await screen.findByText(/We couldn't reach civfix/i)
  })
})

describe("retry safety after a failed commit", () => {
  async function fillAndContinue(user: ReturnType<typeof userEvent.setup>) {
    await user.click(checkbox(/I have read the statements above/i))
    await user.type(screen.getByLabelText(/Email address/i), "donor@example.org")
    await user.click(continueButton())
  }

  it("REUSES the idempotency key after an indeterminate failure, so a retry cannot double-charge", async () => {
    const user = userEvent.setup()
    createDonationCheckout.mockRejectedValueOnce({ code: "INTERNAL" })
    await renderForm()
    await fillAndContinue(user)
    await screen.findByRole("alert")
    await user.click(continueButton())
    await screen.findByTestId("donate-pay")
    expect(createDonationCheckout).toHaveBeenCalledTimes(2)
    expect(createDonationCheckout.mock.calls[0]?.[0]?.idempotencyKey).toBe(
      createDonationCheckout.mock.calls[1]?.[0]?.idempotencyKey,
    )
  })

  it("mints a NEW key after a refusal the server made before writing anything", async () => {
    const user = userEvent.setup()
    createDonationCheckout.mockRejectedValueOnce({ code: "VALIDATION", fields: {} })
    await renderForm()
    await fillAndContinue(user)
    await screen.findByRole("alert")
    await user.click(continueButton())
    await screen.findByTestId("donate-pay")
    expect(createDonationCheckout.mock.calls[0]?.[0]?.idempotencyKey).not.toBe(
      createDonationCheckout.mock.calls[1]?.[0]?.idempotencyKey,
    )
  })

  it("says nothing was charged on every commit failure", async () => {
    const user = userEvent.setup()
    createDonationCheckout.mockRejectedValueOnce({ code: "INTERNAL" })
    await renderForm()
    await fillAndContinue(user)
    expect((await screen.findByRole("alert")).textContent).toMatch(/[Nn]othing was charged/)
  })
})
