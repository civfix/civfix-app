import * as React from "react"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DISCLOSURE_IDS } from "./disclosures-block"
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

function precedes(before: Element, after: Element): boolean {
  return (before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
}

describe("required disclosures precede the commitment", () => {
  it("renders all seven statutory statements", async () => {
    await renderForm()
    for (const id of DISCLOSURE_IDS) {
      const element = document.querySelector(`[data-disclosure="${id}"]`)
      expect(element, `missing disclosure ${id}`).not.toBe(null)
      expect((element as Element).textContent?.trim().length).toBeGreaterThan(0)
    }
  })

  it("puts every disclosure ABOVE the terms checkbox and the Continue button", async () => {
    await renderForm()
    const terms = screen.getByLabelText(/I have read the statements above/i)
    const continueButton = screen.getByTestId("donate-continue")
    for (const id of DISCLOSURE_IDS) {
      const element = document.querySelector(`[data-disclosure="${id}"]`) as Element
      expect(precedes(element, terms), `${id} must precede the terms checkbox`).toBe(true)
      expect(precedes(element, continueButton), `${id} must precede Continue`).toBe(true)
    }
  })

  it("puts every disclosure ABOVE the pay button once the payment panel appears", async () => {
    const user = userEvent.setup()
    await renderForm()
    await user.click(screen.getByLabelText(/I have read the statements above/i))
    await user.type(screen.getByLabelText(/Email address/i), "donor@example.org")
    await user.click(screen.getByTestId("donate-continue"))

    const pay = await screen.findByTestId("donate-pay")
    for (const id of DISCLOSURE_IDS) {
      const element = document.querySelector(`[data-disclosure="${id}"]`) as Element
      expect(precedes(element, pay), `${id} must precede the pay button`).toBe(true)
    }
    const terms = screen.getByLabelText(/I have read the statements above/i)
    expect(precedes(terms, pay)).toBe(true)
  })

  it("never claims 100% of a donation reaches the organization", async () => {
    await renderForm()
    expect(document.body.textContent).not.toContain("100%")
  })

  it("links the may-not-receive reasons to the AB 488 disclosure page", async () => {
    await renderForm()
    const link = screen.getByRole("link", {
      name: /When an organization may not receive your donation/i,
    })
    expect(link.getAttribute("href")).toBe("/legal/donations#may-not-receive")
  })

  it("says when deductibility was last verified", async () => {
    await renderForm()
    const element = document.querySelector('[data-disclosure="deductibility"]') as Element
    expect(element.textContent).toContain("Verified against IRS records on August 1, 2026")
  })
})
