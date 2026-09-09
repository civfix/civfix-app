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

function feeCell(kind: string, scope = "donate-fees"): string {
  return (
    document
      .querySelector(`[data-fee="${kind}"][data-fee-scope="${scope}"]`)
      ?.textContent?.trim() ?? ""
  )
}

describe("fee breakdown", () => {
  it("itemizes the four required rows from the shared fee math", async () => {
    await renderForm()
    expect(feeCell("gross")).toBe("$25.00")
    expect(feeCell("processor")).toBe("\u2212$1.03")
    expect(feeCell("platform")).toBe("\u2212$1.25")
    expect(feeCell("net")).toBe("$22.72")
  })

  it("names the platform fee as civfix's and states the rate", async () => {
    await renderForm()
    const platformRow = document.querySelector('[data-fee="platform"]')?.parentElement
    expect(platformRow?.textContent).toContain("civfix platform fee")
    expect(platformRow?.textContent).toContain("5%")
  })

  it("says the organization pays the processing fee, and that the figure is an estimate", async () => {
    await renderForm()
    const processorRow = document.querySelector('[data-fee="processor"]')?.parentElement
    expect(processorRow?.textContent).toContain("paid by the organization")
    expect(processorRow?.textContent).toContain("Estimated card processing fee")
  })

  it("names the recipient's IRS legal name in the net row, not the display name", async () => {
    await renderForm()
    const netRow = document.querySelector('[data-fee="net"]')?.parentElement
    expect(netRow?.textContent).toContain("Reach Out Los Angeles")
  })

  it("recomputes live as the amount changes, in a polite live region", async () => {
    const user = userEvent.setup()
    await renderForm()
    const amount = screen.getByLabelText(/Amount in US dollars/i)
    await user.clear(amount)
    await user.type(amount, "100")
    expect(feeCell("gross")).toBe("$100.00")
    expect(feeCell("platform")).toBe("\u2212$5.00")
    expect(document.querySelector("[data-fees-authoritative]")?.getAttribute("aria-live")).toBe(
      "polite",
    )
  })

  it("marks the preview as non-authoritative until the server has priced it", async () => {
    const user = userEvent.setup()
    await renderForm()
    expect(
      document.querySelector("[data-fees-authoritative]")?.getAttribute("data-fees-authoritative"),
    ).toBe("false")

    await user.click(screen.getByLabelText(/I have read the statements above/i))
    await user.type(screen.getByLabelText(/Email address/i), "donor@example.org")
    await user.click(screen.getByTestId("donate-continue"))
    await screen.findByTestId("donate-pay")
    expect(
      [...document.querySelectorAll("[data-fees-authoritative]")].some(
        (node) => node.getAttribute("data-fees-authoritative") === "true",
      ),
    ).toBe(true)
  })

  it("prompts for an amount rather than showing zeros", async () => {
    const user = userEvent.setup()
    await renderForm()
    await user.clear(screen.getByLabelText(/Amount in US dollars/i))
    expect(screen.getByText(/Enter an amount to see the breakdown/i)).toBeTruthy()
  })
})
