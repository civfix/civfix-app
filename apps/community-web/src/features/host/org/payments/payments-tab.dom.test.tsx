import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AppError, ErrorCode } from "@civfix/shared"
import type { OrgDonationSettingsDTO, OrgPaymentsState, OrgPaymentsStatusDTO } from "@civfix/shared"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

import { renderConsole } from "@/components/console/__testing__/harness"
import { PaymentsTab } from "./payments-tab"

const ORG_ID = "11111111-1111-4111-8111-111111111111"

function status(over: Partial<OrgPaymentsStatusDTO> = {}): OrgPaymentsStatusDTO {
  return {
    organizationId: ORG_ID,
    state: "not_started",
    stripeAccountId: null,
    livemode: false,
    detailsSubmitted: false,
    chargesEnabled: false,
    payoutsEnabled: false,
    disabledReason: null,
    currentlyDue: [],
    pastDue: [],
    pendingVerification: [],
    futureCurrentlyDue: [],
    currentDeadline: null,
    capabilities: {},
    paymentMethodDomains: [],
    walletsAvailable: [],
    donationsEnabled: false,
    donationsDisabledReason: null,
    agreement: {
      version: null,
      acceptedAt: null,
      acceptedByName: null,
      current: false,
      requiredVersion: "2026-01-01",
    },
    eligibility: {
      verdict: "unknown",
      reasons: [],
      einLast4: null,
      irsLegalName: null,
      deductibilityCode: null,
      foundationCode: null,
      graceExpiresAt: null,
      evaluatedAt: null,
      nextCheckAt: null,
      checks: [],
    },
    donateState: "OFF",
    lastSyncedAt: null,
    ...over,
  }
}

function settings(over: Partial<OrgDonationSettingsDTO> = {}): OrgDonationSettingsDTO {
  return {
    organizationId: ORG_ID,
    enabled: false,
    donorSharingDefault: false,
    missionBlurb: null,
    designationNote: null,
    refundPolicyText: null,
    minAmountMinor: 500,
    maxAmountMinor: 100000,
    suggestedAmountsMinor: [2500, 5000],
    agreedFeeBps: 500,
    effectiveFeeBps: 500,
    legalName: null,
    einLast4: null,
    agreement: status().agreement,
    eligibility: status().eligibility,
    donateState: "OFF",
    ...over,
  }
}

function api(over: Partial<OrgPaymentsStatusDTO>, settingsOver: Partial<OrgDonationSettingsDTO> = {}) {
  return {
    getOrgPaymentsStatus: vi.fn().mockResolvedValue(status(over)),
    getOrgDonationSettings: vi.fn().mockResolvedValue(settings(settingsOver)),
    listOrgDonations: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    getOrgDonationSummary: vi.fn().mockResolvedValue({
      currency: "USD",
      donationCount: 0,
      grossMinor: 0,
      platformFeeMinor: 0,
      processorFeeMinor: 0,
      netMinor: 0,
      refundedMinor: 0,
      disputedCount: 0,
    }),
    listOrgDonationExports: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    requestOrgDonationExport: vi.fn(),
    downloadHostExport: vi.fn(),
    updateOrgDonationSettings: vi.fn(),
    createOrgStripeAccount: vi.fn(),
    createOrgStripeAccountLink: vi.fn(),
    getLegalVersions: vi.fn().mockResolvedValue({ documents: [], generatedAt: "" }),
  }
}

function renderTab(
  over: Partial<OrgPaymentsStatusDTO>,
  options: { canManage?: boolean; settings?: Partial<OrgDonationSettingsDTO> } = {},
) {
  const client = api(over, options.settings ?? {})
  const view = renderConsole(
    <PaymentsTab
      orgId={ORG_ID}
      orgName="Creek Trust"
      canManagePayments={options.canManage ?? true}
      canViewDonations
    />,
    { api: client as never },
  )
  return { ...view, client }
}

let assign = vi.fn()

beforeEach(() => {
  window.history.replaceState(null, "", "/manage/orgs/o1/payments/")
  assign = vi.fn()
  Object.defineProperty(window, "location", {
    writable: true,
    value: { ...window.location, assign, search: "", pathname: "/manage/orgs/o1/payments/" },
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("PaymentsTab connect states", () => {
  const STATES: readonly OrgPaymentsState[] = [
    "not_started",
    "onboarding",
    "ready",
    "at_risk",
    "blocked",
  ]

  it("renders a distinct explanation for each of the five Connect states", async () => {
    for (const state of STATES) {
      const { unmount } = renderTab({ state })
      await screen.findByText(`connect.state_${state}`)
      unmount()
    }
  })

  it("offers the agreement first, not a Stripe account, when the agreement is not current", async () => {
    renderTab({ state: "not_started" })
    await screen.findByText("connect.agreement_required")
    expect(screen.getByRole("button", { name: "connect.review_agreement" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "connect.start" })).toBeNull()
  })

  it("offers Connect once the current agreement is accepted", async () => {
    renderTab({
      state: "not_started",
      agreement: {
        version: "2026-01-01",
        acceptedAt: "2026-01-02T00:00:00.000Z",
        acceptedByName: "Ann",
        current: true,
        requiredVersion: "2026-01-01",
      },
    })
    expect(await screen.findByRole("button", { name: "connect.start" })).toBeTruthy()
  })

  it("offers Continue while onboarding and mints a FRESH link per click", async () => {
    const user = userEvent.setup()
    const { client } = renderTab({ state: "onboarding" })
    client.createOrgStripeAccountLink.mockResolvedValue({
      url: "https://connect.stripe.test/one",
      expiresAt: "2026-01-01T00:05:00.000Z",
    })
    const button = await screen.findByRole("button", { name: "connect.continue" })
    await user.click(button)
    await waitFor(() => expect(client.createOrgStripeAccountLink).toHaveBeenCalledTimes(1))
    expect(client.createOrgStripeAccountLink).toHaveBeenCalledWith({
      id: ORG_ID,
      type: "onboarding",
    })
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://connect.stripe.test/one"))
  })

  it("shows the outstanding Stripe requirements when the account is at risk", async () => {
    renderTab({
      state: "at_risk",
      currentlyDue: ["individual.verification.document"],
      pastDue: ["business_profile.url"],
    })
    await screen.findByText("connect.requirements")
    expect(screen.getByText("business_profile.url")).toBeTruthy()
    expect(screen.getByText("individual.verification.document")).toBeTruthy()
  })

  it("explains a blocked account with Stripe's own reason and offers no action", async () => {
    renderTab({ state: "blocked", disabledReason: "rejected.fraud" })
    await screen.findByText("connect.blocked_reason(reason=rejected.fraud)")
    expect(screen.queryByRole("button", { name: "connect.start" })).toBeNull()
    expect(screen.queryByRole("button", { name: "connect.continue" })).toBeNull()
  })

  it("hides every write action from an org ADMIN who cannot manage payments", async () => {
    renderTab(
      {
        state: "onboarding",
        agreement: {
          version: "2026-01-01",
          acceptedAt: "2026-01-02T00:00:00.000Z",
          acceptedByName: "Ann",
          current: true,
          requiredVersion: "2026-01-01",
        },
      },
      { canManage: false },
    )
    const button = await screen.findByRole("button", { name: "connect.continue" })
    expect(button.hasAttribute("disabled")).toBe(true)
    expect(button.getAttribute("title")).toBe("connect.owner_only")
  })
})

describe("PaymentsTab ?stripe=return", () => {
  it("treats a return as PENDING, never as completion: it re-polls and keeps the old state", async () => {
    window.history.replaceState(null, "", "/manage/orgs/o1/payments/?stripe=return")
    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        ...window.location,
        assign,
        search: "?stripe=return",
        pathname: "/manage/orgs/o1/payments/",
      },
    })

    const replaceState = vi.spyOn(window.history, "replaceState")
    const { client } = renderTab({ state: "onboarding" })

    await screen.findByText("return.pending")
    expect(screen.getByText("connect.state_onboarding")).toBeTruthy()
    expect(screen.queryByText("connect.state_ready")).toBeNull()

    await waitFor(() => expect(replaceState).toHaveBeenCalled())
    const written = String(replaceState.mock.calls.at(-1)?.[2] ?? "")
    expect(written).not.toContain("stripe=return")
    expect(client.getOrgPaymentsStatus).toHaveBeenCalled()
  })

  it("does not show the pending banner on a plain load", async () => {
    renderTab({ state: "onboarding" })
    await screen.findByText("connect.state_onboarding")
    expect(screen.queryByText("return.pending")).toBeNull()
  })
})

describe("PaymentsTab donation settings gating", () => {
  it("locks the enable toggle and names EVERY unmet precondition", async () => {
    renderTab({ state: "not_started" })
    await screen.findByText("settings.blocker_account")
    expect(screen.getByText("settings.blocker_eligibility")).toBeTruthy()
    expect(screen.getByText("settings.blocker_agreement")).toBeTruthy()
    const toggle = screen.getByRole("switch", { name: "settings.enable" })
    expect(toggle.hasAttribute("disabled")).toBe(true)
  })

  it("unlocks the toggle only when account, eligibility AND agreement are all satisfied", async () => {
    const ready = {
      state: "ready" as const,
      chargesEnabled: true,
      agreement: {
        version: "2026-01-01",
        acceptedAt: "2026-01-02T00:00:00.000Z",
        acceptedByName: "Ann",
        current: true,
        requiredVersion: "2026-01-01",
      },
      eligibility: { ...status().eligibility, verdict: "eligible" as const },
    }
    renderTab(ready, { settings: { agreement: ready.agreement, eligibility: ready.eligibility } })
    const toggle = await screen.findByRole("switch", { name: "settings.enable" })
    await waitFor(() => expect(toggle.hasAttribute("disabled")).toBe(false))
    expect(screen.queryByText("settings.blocker_account")).toBeNull()
  })

  it("keeps an operator-disabled org read-only", async () => {
    const accepted = {
      version: "2026-01-01",
      acceptedAt: "2026-01-02T00:00:00.000Z",
      acceptedByName: "Ann",
      current: true,
      requiredVersion: "2026-01-01",
    }
    const eligible = { ...status().eligibility, verdict: "eligible" as const }
    renderTab(
      {
        state: "ready",
        chargesEnabled: true,
        donationsDisabledReason: "operator",
        agreement: accepted,
        eligibility: eligible,
      },
      { settings: { agreement: accepted, eligibility: eligible } },
    )
    await waitFor(() =>
      expect(screen.getAllByText("settings.blocker_operator").length).toBeGreaterThan(0),
    )
    expect(
      screen.getByRole("switch", { name: "settings.enable" }).hasAttribute("disabled"),
    ).toBe(true)
  })

  it("always discloses the platform fee", async () => {
    renderTab({ state: "ready" })
    await screen.findByText("settings.fee_disclosure(percent=5)")
  })
})

describe("PaymentsTab donation exports", () => {
  it("gives the donation ledger a retrieval path, not just a request button", async () => {
    renderTab({ state: "ready" })
    expect(await screen.findByText("exports.title")).toBeTruthy()
    expect(screen.getByRole("button", { name: /exports.request/ })).toBeTruthy()
  })
})

describe("PaymentsTab refund policy claim", () => {
  it("shows the server's field rejection ON the refund field, in the console's own words", async () => {
    const user = userEvent.setup()
    const accepted = {
      version: "2026-01-01",
      acceptedAt: "2026-01-02T00:00:00.000Z",
      acceptedByName: "Ann",
      current: true,
      requiredVersion: "2026-01-01",
    }
    const eligible = { ...status().eligibility, verdict: "eligible" as const }
    const { client } = renderTab(
      { state: "ready", chargesEnabled: true, agreement: accepted, eligibility: eligible },
      { settings: { agreement: accepted, eligibility: eligible } },
    )
    client.updateOrgDonationSettings.mockRejectedValue(
      new AppError(ErrorCode.VALIDATION, "invalid", {
        httpStatus: 422,
        fields: { refundPolicyText: "cannot claim that 100% of a donation reaches the organization" },
      }),
    )

    const field = await screen.findByLabelText(/settings.refund_policy/)
    await user.type(field, "100% goes to the creek")
    await user.click(screen.getByRole("button", { name: "action.save" }))

    expect(await screen.findByText("settings.refund_policy_error")).toBeTruthy()
    expect(
      screen.queryByText("cannot claim that 100% of a donation reaches the organization"),
    ).toBeNull()
  })
})
