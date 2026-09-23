import { describe, expect, it } from "vitest"
import { RegisterOutcomeSchema, type MyEventRegistrationRef, type TicketTypeDTO } from "@civfix/shared"
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

const base = {
  status: "upcoming" as const,
  ended: false,
  ticketTypes: [type()],
  registrationState: "open" as const,
  myRegistration: null,
}

describe("defaultTicketTypeId edges", () => {
  it("skips a first type whose sales are not open", () => {
    expect(
      defaultTicketTypeId([type({ id: "later", sortOrder: 0, salesOpen: false }), type({ id: "now", sortOrder: 1 })]),
    ).toBe("now")
  })

  it("falls back to the lowest sort order, not the first array element, when nothing is open", () => {
    expect(
      defaultTicketTypeId([
        type({ id: "b", sortOrder: 2, salesOpen: false }),
        type({ id: "a", sortOrder: 1, soldOut: true }),
      ]),
    ).toBe("a")
  })

  it("keeps the input order for equal sort orders and never mutates the input", () => {
    const input = [type({ id: "x" }), type({ id: "y" })]
    expect(selectableTicketTypes(input).map((t) => t.id)).toEqual(["x", "y"])
    expect(selectableTicketTypes(input)).not.toBe(input)
  })
})

describe("registrationSurface edges", () => {
  it("offers the waitlist on a full event when any type runs one", () => {
    expect(
      registrationSurface({
        ...base,
        registrationState: "full",
        ticketTypes: [type({ id: "a" }), type({ id: "b", waitlistEnabled: true })],
      }),
    ).toBe("waitlist")
  })

  it("shows the form for an unknown or missing window state", () => {
    expect(registrationSurface({ ...base, registrationState: null })).toBe("form")
    expect(registrationSurface({ ...base, registrationState: undefined })).toBe("form")
  })

  it("reads a waitlisted registration on an ended event as registered", () => {
    expect(
      registrationSurface({ ...base, ended: true, myRegistration: mine({ waitlistPosition: 2 }) }),
    ).toBe("registered")
  })

  it("hides a cancelled registration on a cancelled event", () => {
    expect(
      registrationSurface({ ...base, status: "cancelled", myRegistration: mine({ status: "cancelled" }) }),
    ).toBe("hidden")
  })

  it("treats waitlist position zero as waitlisted", () => {
    expect(registrationSurface({ ...base, myRegistration: mine({ waitlistPosition: 0 }) })).toBe("waitlisted")
  })
})

describe("registerOutcomeKey full table", () => {
  it("maps each refusal to outcome.<name> and each success to null", () => {
    for (const outcome of RegisterOutcomeSchema.options) {
      const expected = ["registered", "replayed", "waitlisted"].includes(outcome) ? null : `outcome.${outcome}`
      expect(registerOutcomeKey(outcome), outcome).toBe(expected)
    }
  })
})

describe("registerErrorKey edges", () => {
  it("falls back to generic for validation and unauthorised", () => {
    expect(registerErrorKey("VALIDATION")).toBe("error.generic")
    expect(registerErrorKey("UNAUTHORIZED")).toBe("error.generic")
  })
})
