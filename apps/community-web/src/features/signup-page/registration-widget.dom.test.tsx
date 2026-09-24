import * as React from "react"
import { act, cleanup, render, screen } from "@testing-library/react"
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

// Copy is asserted by i18n key, so these tests pin behaviour, not English wording.
vi.mock("@civfix/ui/i18n", () => ({
  useT: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options && "count" in options ? `${key}(${String(options.count)})` : key,
    i18n: { language: "en" },
  }),
  Trans: ({ i18nKey }: { i18nKey: string }) => <>{i18nKey}</>,
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
    expect(screen.getByText("widget.cancelled_title")).toBeTruthy()
    expect(screen.queryByRole("button", { name: /form\.count_me_in/ })).toBe(null)
  })

  it("says registration is closed after the window", () => {
    renderWidget(
      page({ event: { ...page().event, registrationClosesAt: "2020-01-01T00:00:00.000Z" } }),
    )
    expect(screen.getByText("widget.closed_title")).toBeTruthy()
  })

  it("says registration has not opened yet", () => {
    renderWidget(
      page({ event: { ...page().event, registrationOpensAt: "2099-01-01T00:00:00.000Z" } }),
    )
    expect(screen.getByText("widget.not_yet_open_title")).toBeTruthy()
  })
})

describe("member one-tap registration", () => {
  it("refuses to submit until the terms box is ticked", async () => {
    const user = userEvent.setup()
    renderWidget(page())
    await user.click(screen.getByRole("button", { name: /form\.count_me_in/ }))
    expect(registerForEvent).not.toHaveBeenCalled()
    expect(screen.getByRole("alert").textContent).toContain("errors.terms")
  })

  it("registers with the contract's current consent versions", async () => {
    const user = userEvent.setup()
    renderWidget(page())
    await user.click(screen.getByLabelText("form.terms"))
    await user.click(screen.getByRole("button", { name: /form\.count_me_in/ }))
    await screen.findByText("web-signup:outcome.registered")
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
    let settle: (value: unknown) => void = () => {}
    registerForEvent.mockReturnValue(new Promise((resolve) => (settle = resolve)))
    renderWidget(page())
    await user.click(screen.getByLabelText("form.terms"))
    const button = screen.getByRole("button", { name: /form\.count_me_in/ })
    // Both taps land before React re-renders the button as disabled.
    act(() => {
      button.click()
      button.click()
    })
    await act(async () => {
      settle({ outcome: "registered", registration: null })
    })
    await screen.findByText("web-signup:outcome.registered")
    expect(registerForEvent).toHaveBeenCalledTimes(1)
  })

  it("shows a waitlisted state when the server waitlists instead of registering", async () => {
    const user = userEvent.setup()
    registerForEvent.mockResolvedValue({ outcome: "waitlisted", registration: null })
    renderWidget(page())
    await user.click(screen.getByLabelText("form.terms"))
    await user.click(screen.getByRole("button", { name: /form\.count_me_in/ }))
    expect(await screen.findByText("widget.waitlisted_title")).toBeTruthy()
  })

  it("surfaces a domain refusal as a message, not as a crash", async () => {
    const user = userEvent.setup()
    registerForEvent.mockResolvedValue({ outcome: "access_code_invalid", registration: null })
    renderWidget(page())
    await user.click(screen.getByLabelText("form.terms"))
    await user.click(screen.getByRole("button", { name: /form\.count_me_in/ }))
    expect((await screen.findByRole("alert")).textContent).toContain("host-ticket:outcome.access_code_invalid")
  })

  it("mints a NEW idempotency key after a refusal, so a retry is a new attempt", async () => {
    const user = userEvent.setup()
    registerForEvent.mockResolvedValueOnce({ outcome: "answers_invalid", registration: null })
    renderWidget(page())
    await user.click(screen.getByLabelText("form.terms"))
    await user.click(screen.getByRole("button", { name: /form\.count_me_in/ }))
    await screen.findByRole("alert")
    await user.click(screen.getByRole("button", { name: /form\.count_me_in/ }))
    await screen.findByText("web-signup:outcome.registered")
    expect(registerForEvent.mock.calls[0]?.[0]?.idempotencyKey).not.toBe(
      registerForEvent.mock.calls[1]?.[0]?.idempotencyKey,
    )
  })
})

describe("access-code and party-size tickets", () => {
  it("asks for an access code and refuses to submit without one", async () => {
    const user = userEvent.setup()
    renderWidget(page({ ticketTypes: [ticket({ requiresAccessCode: true })] }))
    await user.click(screen.getByLabelText("form.terms"))
    await user.click(screen.getByRole("button", { name: /form\.count_me_in/ }))
    expect(registerForEvent).not.toHaveBeenCalled()
    expect(screen.getByRole("alert").textContent).toContain("errors.access_code")
  })

  it("clamps party size to the ticket's own maximum", async () => {
    const user = userEvent.setup()
    renderWidget(page({ ticketTypes: [ticket({ maxPartySize: 4 })] }))
    const party = screen.getByLabelText("form.party_label")
    await user.clear(party)
    await user.type(party, "9")
    await user.click(screen.getByLabelText("form.terms"))
    await user.click(screen.getByRole("button", { name: /form\.count_me_in/ }))
    await screen.findByText("web-signup:outcome.registered")
    expect(registerForEvent.mock.calls[0]?.[0]?.partySize).toBe(4)
  })
})

describe("sold out and waitlist", () => {
  it("offers the waitlist when the only ticket is sold out and allows one", async () => {
    const user = userEvent.setup()
    renderWidget(page({ ticketTypes: [ticket({ soldOut: true, waitlistEnabled: true })] }))
    expect(screen.getByText("form.title_full")).toBeTruthy()
    await user.click(screen.getByRole("button", { name: /form\.join_waitlist/ }))
    expect(await screen.findByText("widget.waitlisted_title")).toBeTruthy()
    expect(joinEventWaitlist).toHaveBeenCalledTimes(1)
  })

  it("does not offer a waitlist the host did not enable", () => {
    renderWidget(page({ ticketTypes: [ticket({ soldOut: true, waitlistEnabled: false })] }))
    expect(screen.getByText("form.full_none")).toBeTruthy()
    expect(screen.queryByRole("button", { name: /join_waitlist/ })).toBe(null)
    expect((screen.getByRole("button", { name: /form\.sold_out/ }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })

  it("tells an anonymous visitor to sign in rather than promising a waitlist the contract cannot give them", async () => {
    authenticated = false
    renderWidget(page({ ticketTypes: [ticket({ soldOut: true, waitlistEnabled: true })] }))
    expect(screen.getByText("form.full_guest")).toBeTruthy()
    expect(screen.queryByRole("button", { name: /form\.join_waitlist/ })).toBe(null)
    expect((screen.getByRole("button", { name: /form\.sold_out/ }) as HTMLButtonElement).disabled).toBe(
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
    await user.click(screen.getByLabelText("form.terms"))
    await user.type(screen.getByLabelText("form.name_label"), "Ada")
    await user.type(screen.getByLabelText("form.email_label"), "nope")
    await user.click(screen.getByRole("button", { name: /form\.register$/ }))
    expect(guestRsvpRequest).not.toHaveBeenCalled()
    expect(screen.getByRole("alert").textContent).toContain("errors.email")
  })

  it("mints a Turnstile token under the guest-RSVP action the backend verifies", async () => {
    const user = userEvent.setup()
    renderWidget(page())
    await user.click(screen.getByLabelText("form.terms"))
    await user.type(screen.getByLabelText("form.name_label"), "Ada")
    await user.type(screen.getByLabelText("form.email_label"), "ada@example.org")
    await user.click(screen.getByRole("button", { name: /form\.register$/ }))
    await screen.findByText("code.title")
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
    await user.click(screen.getByLabelText("form.terms"))
    await user.type(screen.getByLabelText("form.name_label"), "Ada")
    await user.type(screen.getByLabelText("form.email_label"), "ada@example.org")
    await user.click(screen.getByRole("button", { name: /form\.register$/ }))
    expect((await screen.findByRole("alert")).textContent).toContain("errors.bot")
    expect(guestRsvpRequest).not.toHaveBeenCalled()
  })

  it("verifies the code and lands on the registered state", async () => {
    const user = userEvent.setup()
    renderWidget(page())
    await user.click(screen.getByLabelText("form.terms"))
    await user.type(screen.getByLabelText("form.name_label"), "Ada")
    await user.type(screen.getByLabelText("form.email_label"), "ada@example.org")
    await user.click(screen.getByRole("button", { name: /form\.register$/ }))
    await screen.findByText("code.title")
    await user.type(screen.getByLabelText("code.label"), "123456")
    await user.click(screen.getByRole("button", { name: /code\.submit/ }))
    expect(await screen.findByText("web-signup:outcome.registered")).toBeTruthy()
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
    await user.click(screen.getByLabelText("form.terms"))
    await user.click(screen.getByRole("button", { name: /form\.count_me_in/ }))
    await screen.findByText("web-signup:outcome.registered")
    expect(registerForEvent.mock.calls[0]?.[0]?.answers).toEqual([
      { questionId: "q1", value: "no" },
    ])
  })

  it("reveals and then requires the conditional question", async () => {
    const user = userEvent.setup()
    renderWidget(page({ questions: questions as never }))
    await user.click(screen.getByLabelText(/^Yes$/i))
    await user.click(screen.getByLabelText("form.terms"))
    await user.click(screen.getByRole("button", { name: /form\.count_me_in/ }))
    expect(registerForEvent).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText(/Which tools/i), "Rakes")
    await user.click(screen.getByRole("button", { name: /form\.count_me_in/ }))
    await screen.findByText("web-signup:outcome.registered")
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
    await user.click(screen.getByLabelText("form.terms"))
    await user.click(screen.getByRole("button", { name: /form\.count_me_in/ }))
    await screen.findByText("web-signup:outcome.registered")
    expect(registerForEvent.mock.calls[0]?.[0]?.ticketTypeId).toBe("tA")
    expect(registerForEvent.mock.calls[0]?.[0]?.answers).toEqual([])
  })

  it("requires ticket B's own question once ticket B is selected", async () => {
    const user = userEvent.setup()
    renderWidget(page({ ticketTypes: twoTickets, questions: perTicket as never }))
    await user.click(screen.getByLabelText(/Volunteer/i))
    await user.click(screen.getByLabelText("form.terms"))
    await user.click(screen.getByRole("button", { name: /form\.count_me_in/ }))
    expect(registerForEvent).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText(/What shift can you work/i), "Morning")
    await user.click(screen.getByRole("button", { name: /form\.count_me_in/ }))
    await screen.findByText("web-signup:outcome.registered")
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
    await user.click(screen.getByLabelText("form.terms"))
    await user.click(screen.getByRole("button", { name: /form\.count_me_in/ }))
    await screen.findByText("web-signup:outcome.registered")
    expect(registerForEvent.mock.calls[0]?.[0]?.answers).toEqual([])
  })
})

describe("party size entry", () => {
  it("lets a visitor clear the field and type a new number instead of snapping to 1", async () => {
    const user = userEvent.setup()
    renderWidget(page({ ticketTypes: [ticket({ maxPartySize: 4 })] }))
    const party = screen.getByLabelText("form.party_label") as HTMLInputElement
    await user.clear(party)
    await user.type(party, "3")
    expect(party.value).toBe("3")
    await user.click(screen.getByLabelText("form.terms"))
    await user.click(screen.getByRole("button", { name: /form\.count_me_in/ }))
    await screen.findByText("web-signup:outcome.registered")
    expect(registerForEvent.mock.calls[0]?.[0]?.partySize).toBe(3)
  })
})

describe("guest code step", () => {
  beforeEach(() => {
    authenticated = false
  })

  async function reachCodeStep(user: ReturnType<typeof userEvent.setup>) {
    renderWidget(page())
    await user.click(screen.getByLabelText("form.terms"))
    await user.type(screen.getByLabelText("form.name_label"), "Ada")
    await user.type(screen.getByLabelText("form.email_label"), "ada@example.org")
    await user.click(screen.getByRole("button", { name: /form\.register$/ }))
    await screen.findByText("code.title")
  }

  it("keeps the code step on screen, disabled, while the code is being verified", async () => {
    const user = userEvent.setup()
    let fail: (reason: unknown) => void = () => {}
    guestRsvpVerify.mockReturnValue(new Promise((_, reject) => (fail = reject)))
    await reachCodeStep(user)
    await user.type(screen.getByLabelText("code.label"), "123456")
    await user.click(screen.getByRole("button", { name: /code\.submit/ }))
    expect(screen.getByText("code.title")).toBeTruthy()
    expect(screen.queryByLabelText("form.name_label")).toBe(null)
    expect((screen.getByRole("button", { name: /code\.submit/ }) as HTMLButtonElement).disabled).toBe(true)

    await act(async () => {
      fail({ code: "VALIDATION", message: "bad code" })
    })
    expect(screen.getByRole("alert").textContent).toContain("errors.validation")
    // The server's resend cooldown survives a wrong code instead of being reset to zero.
    expect(screen.getByRole("button", { name: /code\.resend_wait\(30\)/ })).toBeTruthy()
  })

  it("sends a new code once the cooldown allows it, staying on the code step", async () => {
    const user = userEvent.setup()
    guestRsvpRequest.mockResolvedValue({ sent: true, resendAfterSec: 0 })
    await reachCodeStep(user)
    await user.click(screen.getByRole("button", { name: /code\.resend$/ }))
    expect(guestRsvpRequest).toHaveBeenCalledTimes(2)
    expect(screen.getByText("code.title")).toBeTruthy()
  })

  it("goes back to the form to change the email, keeping what was typed", async () => {
    const user = userEvent.setup()
    await reachCodeStep(user)
    await user.click(screen.getByRole("button", { name: /code\.change_email/ }))
    expect((screen.getByLabelText("form.email_label") as HTMLInputElement).value).toBe(
      "ada@example.org",
    )
    expect((screen.getByLabelText("form.name_label") as HTMLInputElement).value).toBe("Ada")
  })
})

describe("question accessibility", () => {
  const questions = [
    {
      id: "skills",
      cleanupId: "evt_1",
      kind: "multi_select" as const,
      prompt: "What can you help with?",
      helpText: "Pick all that apply.",
      required: false,
      options: [
        { value: "sort", label: "Sorting" },
        { value: "haul", label: "Hauling" },
      ],
      sortOrder: 0,
    },
    {
      id: "shirt",
      cleanupId: "evt_1",
      kind: "single_select" as const,
      prompt: "Shirt size",
      required: true,
      options: [
        { value: "m", label: "M" },
        { value: "l", label: "L" },
      ],
      sortOrder: 1,
    },
    {
      id: "diet",
      cleanupId: "evt_1",
      kind: "short_text" as const,
      prompt: "Dietary needs",
      required: true,
      options: [],
      sortOrder: 2,
    },
  ]

  it("shows and links the help text of a multi-select question", () => {
    renderWidget(page({ questions: questions as never }))
    const help = screen.getByText("Pick all that apply.")
    const group = screen.getByRole("group", { name: /What can you help with/ })
    expect(group.getAttribute("aria-describedby")).toContain(help.id)
  })

  it("marks required questions for assistive tech and links the error to the invalid ones", async () => {
    const user = userEvent.setup()
    renderWidget(page({ questions: questions as never }))
    const diet = screen.getByLabelText(/Dietary needs/)
    const shirt = screen.getByRole("radiogroup", { name: /Shirt size/ })
    expect(diet.getAttribute("aria-required")).toBe("true")
    expect(shirt.getAttribute("aria-required")).toBe("true")

    await user.click(screen.getByLabelText("form.terms"))
    await user.click(screen.getByRole("button", { name: /form\.count_me_in/ }))
    const alert = screen.getByRole("alert")
    expect(diet.getAttribute("aria-invalid")).toBe("true")
    expect(diet.getAttribute("aria-describedby")).toContain(alert.id)
    expect(shirt.getAttribute("aria-invalid")).toBe("true")
    expect(shirt.getAttribute("aria-describedby")).toContain(alert.id)
  })
})
