import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import type { CleanupDTO, MyEventRegistrationRef, TicketTypeDTO } from "@civfix/shared"
import {
  defaultTicketTypeId,
  registerErrorKey,
  registerOutcomeKey,
  registrationSurface,
  selectableTicketTypes,
} from "../registration/registrationModel"

const type = (over: Partial<TicketTypeDTO> = {}): TicketTypeDTO => ({
  id: "tt1",
  cleanupId: "e1",
  name: "General",
  reserved: 0,
  sold: 0,
  visibility: "public",
  accessCodeSet: false,
  maxPartySize: 1,
  sortOrder: 0,
  questionIds: [],
  soldOut: false,
  salesOpen: true,
  waitlistEnabled: false,
  ...over,
})

const mine = (over: Partial<MyEventRegistrationRef> = {}): MyEventRegistrationRef => ({
  id: "r1",
  status: "registered",
  seatCount: 1,
  checkedIn: false,
  canCancel: true,
  ...over,
})

const surface = (over: {
  status?: CleanupDTO["status"]
  ended?: boolean
  ticketTypes?: TicketTypeDTO[]
  registrationState?: CleanupDTO["registrationState"]
  myRegistration?: CleanupDTO["myRegistration"]
} = {}) =>
  registrationSurface({
    status: over.status ?? "upcoming",
    ended: over.ended ?? false,
    ticketTypes: over.ticketTypes ?? [type()],
    registrationState: over.registrationState ?? "open",
    myRegistration: over.myRegistration ?? null,
  })

describe("registrationSurface", () => {
  it("HIDES itself entirely when the event has no ticket types - the RSVP pill still owns that event", () => {
    expect(surface({ ticketTypes: [] })).toBe("hidden")
  })

  it("shows the form for an open event with types", () => {
    expect(surface()).toBe("form")
  })

  it("shows the viewer's own seat before anything else", () => {
    expect(surface({ myRegistration: mine() })).toBe("registered")
    expect(surface({ registrationState: "full", myRegistration: mine() })).toBe("registered")
    expect(surface({ registrationState: "closed", myRegistration: mine() })).toBe("registered")
  })

  it("keeps a registered viewer's seat visible on an ENDED or CANCELLED event", () => {
    expect(surface({ ended: true, myRegistration: mine() })).toBe("registered")
    expect(surface({ status: "cancelled", myRegistration: mine() })).toBe("registered")
  })

  it("hides the block on an ended/cancelled event the viewer never registered for", () => {
    expect(surface({ ended: true })).toBe("hidden")
    expect(surface({ status: "cancelled" })).toBe("hidden")
  })

  it("reads the END TIME, not the stored status - a stale 'done' row no longer closes registration", () => {
    expect(surface({ status: "done", ended: false })).toBe("form")
    expect(surface({ status: "upcoming", ended: true })).toBe("hidden")
  })

  it("distinguishes a waitlisted registration from a seated one", () => {
    expect(surface({ myRegistration: mine({ waitlistPosition: 3 }) })).toBe("waitlisted")
  })

  it("offers a re-register path after the viewer cancelled", () => {
    expect(surface({ myRegistration: mine({ status: "cancelled" }) })).toBe("cancelled")
  })

  it("ranks the window states ABOVE a cancelled registration - it holds no seat", () => {
    const cancelled = mine({ status: "cancelled" })
    expect(surface({ registrationState: "closed", myRegistration: cancelled })).toBe("closed")
    expect(surface({ registrationState: "not_yet_open", myRegistration: cancelled })).toBe("not_yet_open")
    expect(surface({ registrationState: "waitlist", myRegistration: cancelled })).toBe("waitlist")
    expect(surface({ registrationState: "full", myRegistration: cancelled })).toBe("closed")
  })

  it("renders the window states", () => {
    expect(surface({ registrationState: "not_yet_open" })).toBe("not_yet_open")
    expect(surface({ registrationState: "closed" })).toBe("closed")
    expect(surface({ registrationState: "waitlist" })).toBe("waitlist")
  })

  it("only offers a waitlist on a FULL event that actually runs one", () => {
    expect(surface({ registrationState: "full" })).toBe("closed")
    expect(
      surface({ registrationState: "full", ticketTypes: [type({ waitlistEnabled: true })] }),
    ).toBe("waitlist")
  })
})

describe("ticket type selection", () => {
  it("orders by the host's sort order", () => {
    const ordered = selectableTicketTypes([
      type({ id: "b", sortOrder: 2 }),
      type({ id: "a", sortOrder: 1 }),
    ])
    expect(ordered.map((t) => t.id)).toEqual(["a", "b"])
  })

  it("preselects the first type that is actually open", () => {
    expect(
      defaultTicketTypeId([
        type({ id: "sold", sortOrder: 0, soldOut: true }),
        type({ id: "open", sortOrder: 1 }),
      ]),
    ).toBe("open")
  })

  it("falls back to the first type when none are open, so the picker is never blank", () => {
    expect(
      defaultTicketTypeId([type({ id: "a", sortOrder: 0, soldOut: true })]),
    ).toBe("a")
    expect(defaultTicketTypeId([])).toBeNull()
  })
})

describe("idempotency", () => {
  it("mints ONE key per attempt-set, not one per press", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../registration/RegistrationBlock.tsx", import.meta.url)),
      "utf8",
    )
    expect(src).toMatch(/useState\(\(\) => randomId\(\)\)/)
    expect(src).toContain("idempotencyKey,")
    expect(src).not.toMatch(/idempotencyKey:\s*randomId\(\)/)
    expect(src).toContain("setIdempotencyKey(randomId())")
  })
})

describe("outcome + error copy", () => {
  it("renders NO error for the three success arms", () => {
    expect(registerOutcomeKey("registered")).toBeNull()
    expect(registerOutcomeKey("replayed")).toBeNull()
    expect(registerOutcomeKey("waitlisted")).toBeNull()
  })

  it("gives every refusal its own copy key", () => {
    const refusals = [
      "already_registered",
      "full",
      "party_too_large",
      "sales_closed",
      "registration_closed",
      "ticket_type_not_found",
      "access_code_required",
      "access_code_invalid",
      "answers_invalid",
      "banned",
      "closed",
      "not_found",
    ] as const
    const keys = refusals.map((outcome) => registerOutcomeKey(outcome))
    expect(keys.every((key) => typeof key === "string")).toBe(true)
    expect(new Set(keys).size).toBe(refusals.length)
  })

  it("maps the AppError codes a registration can fail with", () => {
    expect(registerErrorKey("CONFLICT")).toBe("outcome.closed")
    expect(registerErrorKey("FORBIDDEN")).toBe("outcome.banned")
    expect(registerErrorKey("RATE_LIMITED")).toBe("error.rate_limited")
    expect(registerErrorKey("NOT_FOUND")).toBe("outcome.not_found")
    expect(registerErrorKey(undefined)).toBe("error.generic")
  })
})
