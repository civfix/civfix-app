import * as React from "react"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { GUEST_RSVP_TURNSTILE_ACTION } from "@civfix/shared"
import type { PublicEventPageDTO, PublicPageTicketType } from "@civfix/shared"

const registerForEvent = vi.fn()
const guestRsvpRequest = vi.fn()
const guestRsvpVerify = vi.fn()
const joinEventWaitlist = vi.fn()
const runTurnstile = vi.fn()

let authenticated = true

vi.mock("@/lib/api", () => ({
  api: {
    registerForEvent: (...args: unknown[]) => registerForEvent(...args),
    guestRsvpRequest: (...args: unknown[]) => guestRsvpRequest(...args),
    guestRsvpVerify: (...args: unknown[]) => guestRsvpVerify(...args),
    joinEventWaitlist: (...args: unknown[]) => joinEventWaitlist(...args),
  },
  toAppError: (error: unknown) => error,
}))

vi.mock("@/lib/turnstile", () => ({
  TURNSTILE_SITEKEY: "1x000",
  runTurnstile: (...args: unknown[]) => runTurnstile(...args),
}))

vi.mock("@/store/auth-store", () => ({
  useAuthStore: (selector: (store: unknown) => unknown) =>
    selector({ status: authenticated ? "authenticated" : "anonymous", user: null }),
}))

const { RegistrationWidget } = await import("./registration-widget")

function ticket(overrides: Partial<PublicPageTicketType> = {}): PublicPageTicketType {
  return {
    id: "t1",
    name: "General",
    maxPartySize: 1,
    soldOut: false,
    salesOpen: true,
    waitlistEnabled: false,
    sortOrder: 0,
    requiresAccessCode: false,
    ...overrides,
  }
}

function page(overrides: Partial<PublicEventPageDTO> = {}): PublicEventPageDTO {
  return {
    slug: "beach-cleanup",
    status: "published",
    visibility: "public",
    noindex: false,
    theme: { accent: "bloom" },
    coverUrl: null,
    blocks: [],
    seo: { noindex: false },
    event: {
      id: "evt_1",
      title: "Beach cleanup",
      startsAt: "2099-05-10T17:00:00.000Z",
      status: "upcoming",
    },
    ticketTypes: [ticket()],
    questions: [],
    consentVersions: { termsVersion: "2026-09-06", disclosureVersion: "2026-09-06" },
    waitlistEnabled: false,
    requiresTurnstile: true,
    ...overrides,
  } as PublicEventPageDTO
}

function renderWidget(dto: PublicEventPageDTO) {
  render(<RegistrationWidget page={dto} initialAccessCode={null} />)
}

beforeEach(() => {
  authenticated = true
  registerForEvent.mockReset().mockResolvedValue({ outcome: "registered", registration: null })
  guestRsvpRequest.mockReset().mockResolvedValue({ sent: true, resendAfterSec: 30 })
  guestRsvpVerify.mockReset().mockResolvedValue({ joined: true, going: 1, manageToken: "x" })
  joinEventWaitlist.mockReset().mockResolvedValue({ entry: {} })
  runTurnstile.mockReset().mockResolvedValue("turnstile-token")
})

afterEach(() => {
  cleanup()
})

describe("terminal event states never show a form", () => {
  it("says a cancelled event is cancelled", () => {
    renderWidget(page({ event: { ...page().event, status: "cancelled" } }))
    expect(screen.getByText(/This event was cancelled/i)).toBeTruthy()
    expect(screen.queryByRole("button", { name: /Count me in/i })).toBe(null)
  })

  it("says registration is closed after the window", () => {
    renderWidget(
      page({ event: { ...page().event, registrationClosesAt: "2020-01-01T00:00:00.000Z" } }),
    )
    expect(screen.getByText(/Registration is closed/i)).toBeTruthy()
  })

  it("says registration has not opened yet", () => {
    renderWidget(
      page({ event: { ...page().event, registrationOpensAt: "2099-01-01T00:00:00.000Z" } }),
    )
    expect(screen.getByText(/Registration hasn.t opened yet/i)).toBeTruthy()
  })
})

describe("member one-tap registration", () => {
  it("refuses to submit until the terms box is ticked", async () => {
    const user = userEvent.setup()
    renderWidget(page())
    await user.click(screen.getByRole("button", { name: /Count me in/i }))
    expect(registerForEvent).not.toHaveBeenCalled()
    expect(screen.getByRole("alert").textContent).toMatch(/accept the terms/i)
  })

  it("registers with the contract's current consent versions", async () => {
    const user = userEvent.setup()
    renderWidget(page())
    await user.click(screen.getByLabelText(/I agree to the/i))
    await user.click(screen.getByRole("button", { name: /Count me in/i }))
    await screen.findByText(/You.re registered/i)
    const body = registerForEvent.mock.calls[0]?.[0]
    expect(body.consent).toMatchObject({
      disclosureVersion: "2026-09-06",
      hostContactOptIn: false,
      surface: "web_register",
    })
    expect(body.idempotencyKey.length).toBeGreaterThan(7)
  })

  it("keeps ONE idempotency key across a repeated tap on the same attempt", async () => {
    const user = userEvent.setup()
    renderWidget(page())
    await user.click(screen.getByLabelText(/I agree to the/i))
    const button = screen.getByRole("button", { name: /Count me in/i })
    await user.click(button)
    await screen.findByText(/You.re registered/i)
    expect(registerForEvent).toHaveBeenCalledTimes(1)
  })

  it("shows a waitlisted state when the server waitlists instead of registering", async () => {
    const user = userEvent.setup()
    registerForEvent.mockResolvedValue({ outcome: "waitlisted", registration: null })
    renderWidget(page())
    await user.click(screen.getByLabelText(/I agree to the/i))
    await user.click(screen.getByRole("button", { name: /Count me in/i }))
    expect(await screen.findByText(/You.re on the waitlist/i)).toBeTruthy()
  })

  it("surfaces a domain refusal as a message, not as a crash", async () => {
    const user = userEvent.setup()
    registerForEvent.mockResolvedValue({ outcome: "access_code_invalid", registration: null })
    renderWidget(page())
    await user.click(screen.getByLabelText(/I agree to the/i))
    await user.click(screen.getByRole("button", { name: /Count me in/i }))
    expect((await screen.findByRole("alert")).textContent).toMatch(/access code is not valid/i)
  })

  it("mints a NEW idempotency key after a refusal, so a retry is a new attempt", async () => {
    const user = userEvent.setup()
    registerForEvent.mockResolvedValueOnce({ outcome: "answers_invalid", registration: null })
    renderWidget(page())
    await user.click(screen.getByLabelText(/I agree to the/i))
    await user.click(screen.getByRole("button", { name: /Count me in/i }))
    await screen.findByRole("alert")
    await user.click(screen.getByRole("button", { name: /Count me in/i }))
    await screen.findByText(/You.re registered/i)
    expect(registerForEvent.mock.calls[0]?.[0]?.idempotencyKey).not.toBe(
      registerForEvent.mock.calls[1]?.[0]?.idempotencyKey,
    )
  })
})

describe("access-code and party-size tickets", () => {
  it("asks for an access code and refuses to submit without one", async () => {
    const user = userEvent.setup()
    renderWidget(page({ ticketTypes: [ticket({ requiresAccessCode: true })] }))
    await user.click(screen.getByLabelText(/I agree to the/i))
    await user.click(screen.getByRole("button", { name: /Count me in/i }))
    expect(registerForEvent).not.toHaveBeenCalled()
    expect(screen.getByRole("alert").textContent).toMatch(/access code/i)
  })

  it("clamps party size to the ticket's own maximum", async () => {
    const user = userEvent.setup()
    renderWidget(page({ ticketTypes: [ticket({ maxPartySize: 4 })] }))
    const party = screen.getByLabelText(/How many people/i)
    await user.clear(party)
    await user.type(party, "9")
    await user.click(screen.getByLabelText(/I agree to the/i))
    await user.click(screen.getByRole("button", { name: /Count me in/i }))
    await screen.findByText(/You.re registered/i)
    expect(registerForEvent.mock.calls[0]?.[0]?.partySize).toBe(4)
  })
})

describe("sold out and waitlist", () => {
  it("offers the waitlist when the only ticket is sold out and allows one", async () => {
    const user = userEvent.setup()
    renderWidget(page({ ticketTypes: [ticket({ soldOut: true, waitlistEnabled: true })] }))
    expect(screen.getByText(/This event is full/i)).toBeTruthy()
    await user.click(screen.getByRole("button", { name: /Join the waitlist/i }))
    expect(await screen.findByText(/You.re on the waitlist/i)).toBeTruthy()
    expect(joinEventWaitlist).toHaveBeenCalledTimes(1)
  })

  it("does not offer a waitlist the host did not enable", () => {
    renderWidget(page({ ticketTypes: [ticket({ soldOut: true, waitlistEnabled: false })] }))
    expect(screen.getByText(/There are no spots left/i)).toBeTruthy()
    expect(screen.queryByRole("button", { name: /waitlist/i })).toBe(null)
    expect((screen.getByRole("button", { name: /Sold out/i }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })

  it("tells an anonymous visitor to sign in rather than promising a waitlist the contract cannot give them", async () => {
    authenticated = false
    renderWidget(page({ ticketTypes: [ticket({ soldOut: true, waitlistEnabled: true })] }))
    expect(screen.getByText(/Sign in to a civfix account to join the waitlist/i)).toBeTruthy()
    expect(screen.queryByRole("button", { name: /Join the waitlist/i })).toBe(null)
    expect((screen.getByRole("button", { name: /Sold out/i }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    expect(guestRsvpRequest).not.toHaveBeenCalled()
  })
})

describe("guest signup", () => {
  beforeEach(() => {
    authenticated = false
  })

  it("collects a name and an email, and refuses an unusable address", async () => {
    const user = userEvent.setup()
    renderWidget(page())
    await user.click(screen.getByLabelText(/I agree to the/i))
    await user.type(screen.getByLabelText(/Your name/i), "Ada")
    await user.type(screen.getByLabelText(/Email address/i), "nope")
    await user.click(screen.getByRole("button", { name: /^Register$/i }))
    expect(guestRsvpRequest).not.toHaveBeenCalled()
    expect(screen.getByRole("alert").textContent).toMatch(/email address/i)
  })

  it("mints a Turnstile token under the guest-RSVP action the backend verifies", async () => {
    const user = userEvent.setup()
    renderWidget(page())
    await user.click(screen.getByLabelText(/I agree to the/i))
    await user.type(screen.getByLabelText(/Your name/i), "Ada")
    await user.type(screen.getByLabelText(/Email address/i), "ada@example.org")
    await user.click(screen.getByRole("button", { name: /^Register$/i }))
    await screen.findByText(/Check your email/i)
    expect(runTurnstile).toHaveBeenCalledWith(GUEST_RSVP_TURNSTILE_ACTION)
    expect(guestRsvpRequest.mock.calls[0]?.[0]).toMatchObject({
      channel: "email",
      email: "ada@example.org",
      turnstileToken: "turnstile-token",
    })
  })

  it("refuses to send anything when Turnstile cannot mint a token", async () => {
    const user = userEvent.setup()
    runTurnstile.mockResolvedValue("")
    renderWidget(page())
    await user.click(screen.getByLabelText(/I agree to the/i))
    await user.type(screen.getByLabelText(/Your name/i), "Ada")
    await user.type(screen.getByLabelText(/Email address/i), "ada@example.org")
    await user.click(screen.getByRole("button", { name: /^Register$/i }))
    expect((await screen.findByRole("alert")).textContent).toMatch(/not a bot/i)
    expect(guestRsvpRequest).not.toHaveBeenCalled()
  })

  it("verifies the code and lands on the registered state", async () => {
    const user = userEvent.setup()
    renderWidget(page())
    await user.click(screen.getByLabelText(/I agree to the/i))
    await user.type(screen.getByLabelText(/Your name/i), "Ada")
    await user.type(screen.getByLabelText(/Email address/i), "ada@example.org")
    await user.click(screen.getByRole("button", { name: /^Register$/i }))
    await screen.findByText(/Check your email/i)
    await user.type(screen.getByLabelText(/Confirmation code/i), "123456")
    await user.click(screen.getByRole("button", { name: /Finish registering/i }))
    expect(await screen.findByText(/You.re registered/i)).toBeTruthy()
    expect(guestRsvpVerify.mock.calls[0]?.[0]?.code).toBe("123456")
  })
})

describe("custom registration questions", () => {
  const questions = [
    {
      id: "q1",
      cleanupId: "evt_1",
      kind: "single_select" as const,
      prompt: "Are you bringing tools?",
      required: true,
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
      sortOrder: 0,
    },
    {
      id: "q2",
      cleanupId: "evt_1",
      kind: "short_text" as const,
      prompt: "Which tools?",
      required: true,
      options: [],
      sortOrder: 1,
      showIf: { questionId: "q1", equals: "yes" },
    },
  ]

  it("hides a conditional question and does not require an answer to it", async () => {
    const user = userEvent.setup()
    renderWidget(page({ questions: questions as never }))
    expect(screen.queryByLabelText(/Which tools/i)).toBe(null)
    await user.click(screen.getByLabelText(/^No$/i))
    await user.click(screen.getByLabelText(/I agree to the/i))
    await user.click(screen.getByRole("button", { name: /Count me in/i }))
    await screen.findByText(/You.re registered/i)
    expect(registerForEvent.mock.calls[0]?.[0]?.answers).toEqual([
      { questionId: "q1", value: "no" },
    ])
  })

  it("reveals and then requires the conditional question", async () => {
    const user = userEvent.setup()
    renderWidget(page({ questions: questions as never }))
    await user.click(screen.getByLabelText(/^Yes$/i))
    await user.click(screen.getByLabelText(/I agree to the/i))
    await user.click(screen.getByRole("button", { name: /Count me in/i }))
    expect(registerForEvent).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText(/Which tools/i), "Rakes")
    await user.click(screen.getByRole("button", { name: /Count me in/i }))
    await screen.findByText(/You.re registered/i)
    expect(registerForEvent.mock.calls[0]?.[0]?.answers).toEqual([
      { questionId: "q1", value: "yes" },
      { questionId: "q2", value: "Rakes" },
    ])
  })
})

describe("questions scoped to a ticket type", () => {
  const twoTickets = [
    ticket({ id: "tA", name: "General", sortOrder: 0 }),
    ticket({ id: "tB", name: "Volunteer", sortOrder: 1 }),
  ]
  const perTicket = [
    {
      id: "forB",
      cleanupId: "evt_1",
      kind: "short_text" as const,
      prompt: "What shift can you work?",
      required: true,
      ticketTypeId: "tB",
      options: [],
      sortOrder: 0,
    },
  ]

  it("does not block ticket A on a required question that belongs to ticket B", async () => {
    const user = userEvent.setup()
    renderWidget(page({ ticketTypes: twoTickets, questions: perTicket as never }))
    expect(screen.queryByLabelText(/What shift can you work/i)).toBe(null)
    await user.click(screen.getByLabelText(/I agree to the/i))
    await user.click(screen.getByRole("button", { name: /Count me in/i }))
    await screen.findByText(/You.re registered/i)
    expect(registerForEvent.mock.calls[0]?.[0]?.ticketTypeId).toBe("tA")
    expect(registerForEvent.mock.calls[0]?.[0]?.answers).toEqual([])
  })

  it("requires ticket B's own question once ticket B is selected", async () => {
    const user = userEvent.setup()
    renderWidget(page({ ticketTypes: twoTickets, questions: perTicket as never }))
    await user.click(screen.getByLabelText(/Volunteer/i))
    await user.click(screen.getByLabelText(/I agree to the/i))
    await user.click(screen.getByRole("button", { name: /Count me in/i }))
    expect(registerForEvent).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText(/What shift can you work/i), "Morning")
    await user.click(screen.getByRole("button", { name: /Count me in/i }))
    await screen.findByText(/You.re registered/i)
    expect(registerForEvent.mock.calls[0]?.[0]?.answers).toEqual([
      { questionId: "forB", value: "Morning" },
    ])
  })

  it("never submits an answer left over from a ticket the donor switched away from", async () => {
    const user = userEvent.setup()
    renderWidget(page({ ticketTypes: twoTickets, questions: perTicket as never }))
    await user.click(screen.getByLabelText(/Volunteer/i))
    await user.type(screen.getByLabelText(/What shift can you work/i), "Morning")
    await user.click(screen.getByLabelText(/General/i))
    await user.click(screen.getByLabelText(/I agree to the/i))
    await user.click(screen.getByRole("button", { name: /Count me in/i }))
    await screen.findByText(/You.re registered/i)
    expect(registerForEvent.mock.calls[0]?.[0]?.answers).toEqual([])
  })
})
