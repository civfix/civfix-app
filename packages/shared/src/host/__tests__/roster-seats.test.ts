import { describe, expect, it } from "vitest"
import type { EventRegistrationDTO, EventSeatDTO, PersonDTO } from "../../schemas/entities.js"
import {
  attendeeDisplayName,
  checkableSeatIds,
  lastCheckedInSeat,
  nextCheckinSeat,
} from "../roster-seats.js"

function seat(over: Partial<EventSeatDTO> = {}): EventSeatDTO {
  return {
    id: "s1",
    seatIndex: 0,
    status: "active",
    attendeeName: null,
    ticketToken: null,
    checkedInAt: null,
    checkinMethod: null,
    noShowAt: null,
    ...over,
  }
}

function person(over: Partial<PersonDTO> = {}): PersonDTO {
  return { id: "p1", name: "Ann", followers: 0, following: 0, isFollowing: false, ...over }
}

type NamedRow = Pick<EventRegistrationDTO, "person" | "guestName">

const NAMES = { guest: "Guest", deleted: "Deleted user" }

describe("checkableSeatIds", () => {
  it("offers only active seats not yet checked in", () => {
    const row = {
      seats: [
        seat({ id: "a" }),
        seat({ id: "b", checkedInAt: "2026-03-01T10:00:00.000Z" }),
        seat({ id: "c", status: "cancelled" }),
      ],
    }
    expect(checkableSeatIds(row)).toEqual(["a"])
  })

  it("reads a seat with no check-in stamp at all as not checked in", () => {
    const { checkedInAt: _omitted, ...unstamped } = seat({ id: "a" })
    expect(checkableSeatIds({ seats: [unstamped] })).toEqual(["a"])
  })
})

describe("nextCheckinSeat", () => {
  it("checks in the first open seat, and none once every seat is in", () => {
    expect(
      nextCheckinSeat({
        seats: [seat({ id: "a", checkedInAt: "2026-03-01T10:00:00.000Z" }), seat({ id: "b" }), seat({ id: "c" })],
      }),
    ).toBe("b")
    expect(nextCheckinSeat({ seats: [seat({ id: "a", checkedInAt: "2026-03-01T10:00:00.000Z" })] })).toBeNull()
    expect(nextCheckinSeat({ seats: [seat({ id: "a", status: "cancelled" })] })).toBeNull()
  })
})

describe("lastCheckedInSeat", () => {
  it("undoes the most recent active check-in", () => {
    expect(
      lastCheckedInSeat({
        seats: [
          seat({ id: "early", checkedInAt: "2026-03-01T10:00:00.000Z" }),
          seat({ id: "late", checkedInAt: "2026-03-01T11:00:00.000Z" }),
          seat({ id: "open" }),
          seat({ id: "gone", status: "cancelled", checkedInAt: "2026-03-01T12:00:00.000Z" }),
        ],
      }),
    ).toBe("late")
    expect(lastCheckedInSeat({ seats: [seat({ id: "open" })] })).toBeNull()
  })
})

describe("attendeeDisplayName", () => {
  it("names a member, a guest and a deleted user distinctly", () => {
    const row = (over: Partial<NamedRow>): NamedRow => ({ person: null, guestName: null, ...over })
    expect(attendeeDisplayName(row({ guestName: "Ann" }), NAMES)).toBe("Ann")
    expect(attendeeDisplayName(row({}), NAMES)).toBe("Guest")
    expect(attendeeDisplayName(row({ person: person({ name: "Bo" }) }), NAMES)).toBe("Bo")
    expect(attendeeDisplayName(row({ person: person({ deleted: true }) }), NAMES)).toBe("Deleted user")
  })

  it("leaves each host its own fallback copy", () => {
    const blank = { guest: "", deleted: "Deleted User" }
    expect(attendeeDisplayName({ person: null, guestName: null }, blank)).toBe("")
    expect(attendeeDisplayName({ person: person({ deleted: true }), guestName: "Ann" }, blank)).toBe(
      "Deleted User",
    )
  })
})
