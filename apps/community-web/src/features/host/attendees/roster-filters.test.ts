import type { EventRegistrationDTO, EventSeatDTO } from "@civfix/shared"
import { RegistrationRosterFilterSchema, RegistrationRosterSortSchema } from "@civfix/shared"
import { describe, expect, it } from "vitest"

import {
  ROSTER_FILTERS,
  attendanceOf,
  checkInSeatsInRow,
  isRosterFilter,
  isRosterSort,
  isWaitlistProjection,
  rosterEventTotal,
  rowStillPendingCheckIn,
  rowSupportsRegistrationActions,
} from "./roster-filters"

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

function row(over: Partial<EventRegistrationDTO> = {}): EventRegistrationDTO {
  return {
    id: "r1",
    cleanupId: "e1",
    kind: "member",
    person: null,
    guestName: null,
    ticketTypeId: null,
    ticketTypeName: null,
    partySize: 1,
    seatCount: 1,
    seats: [],
    status: "registered",
    source: "self",
    registeredAt: "2026-03-01T00:00:00.000Z",
    cancelledAt: null,
    checkedInAt: null,
    checkedInBy: null,
    slot: null,
    waitlistPosition: null,
    answersPreview: null,
    answers: null,
    note: null,
    ...over,
  }
}

describe("roster filters", () => {
  it("recognises every contract filter and sort", () => {
    for (const filter of ROSTER_FILTERS) expect(isRosterFilter(filter)).toBe(true)
    expect(isRosterFilter("nope")).toBe(false)
    expect(isRosterFilter(undefined)).toBe(false)
    expect(isRosterSort("name_asc")).toBe(true)
    expect(isRosterSort("name_desc")).toBe(false)
  })

  it("covers exactly the contract's filters and sorts", () => {
    expect([...ROSTER_FILTERS].sort()).toEqual([...RegistrationRosterFilterSchema.options].sort())
    for (const sort of RegistrationRosterSortSchema.options) expect(isRosterSort(sort)).toBe(true)
  })

  it("treats ONLY filter=waitlisted as the waitlist projection", () => {
    expect(isWaitlistProjection("waitlisted")).toBe(true)
    for (const filter of ROSTER_FILTERS.filter((f) => f !== "waitlisted")) {
      expect(isWaitlistProjection(filter), filter).toBe(false)
    }
  })

  it("offers no registration action on a waitlist row, whose id addresses another table", () => {
    expect(rowSupportsRegistrationActions(row(), "waitlisted")).toBe(false)
    expect(rowSupportsRegistrationActions(row(), "all")).toBe(true)
  })

  it("offers no registration action on a cancelled row", () => {
    expect(rowSupportsRegistrationActions(row({ status: "cancelled" }), "all")).toBe(false)
  })

  it("derives attendance, preferring checked-in over a stale no-show stamp", () => {
    expect(attendanceOf(row())).toBe("not_checked_in")
    expect(attendanceOf(row({ seats: [seat({ noShowAt: "2026-03-02T00:00:00.000Z" })] }))).toBe(
      "no_show",
    )
    expect(
      attendanceOf(
        row({
          checkedInAt: "2026-03-01T10:00:00.000Z",
          seats: [seat({ noShowAt: "2026-03-02T00:00:00.000Z" })],
        }),
      ),
    ).toBe("checked_in")
  })
})

describe("rosterEventTotal", () => {
  it("keeps the whole-event total distinct from the filtered row count", () => {
    const firstPage = { items: [row(), row({ id: "r2" })], nextCursor: "c2", total: 87 }
    const secondPage = { items: [row({ id: "r3" })], nextCursor: null, total: 3 }
    const untotalledPage = { items: [row()], nextCursor: null }
    expect(rosterEventTotal([firstPage, secondPage])).toBe(87)
    expect(rosterEventTotal([untotalledPage])).toBeNull()
    expect(rosterEventTotal([])).toBeNull()
    expect(rosterEventTotal(undefined)).toBeNull()
  })
})

const AT = "2026-09-06T18:00:00.000Z"

function party(
  seats: EventSeatDTO[] = [seat({ id: "s1" }), seat({ id: "s2" }), seat({ id: "s3" })],
): EventRegistrationDTO {
  return row({ kind: "guest", guestName: "Ada", partySize: 3, seatCount: seats.length, seats })
}

describe("checkInSeatsInRow", () => {
  it("checks in every seat it is given", () => {
    const next = checkInSeatsInRow(party(), ["s1", "s2", "s3"], AT)
    expect(next.seats.map((s) => s.checkedInAt)).toEqual([AT, AT, AT])
    expect(next.checkedInAt).toBe(AT)
  })

  it("leaves seats it was not given alone", () => {
    const next = checkInSeatsInRow(party(), ["s1"], AT)
    expect(next.seats.map((s) => s.checkedInAt)).toEqual([AT, null, null])
    expect(rowStillPendingCheckIn(next)).toBe(true)
  })

  it("never re-stamps a seat that was already checked in", () => {
    const earlier = "2026-09-06T17:00:00.000Z"
    const next = checkInSeatsInRow(
      party([seat({ id: "s1", checkedInAt: earlier }), seat({ id: "s2" })]),
      ["s1", "s2"],
      AT,
    )
    expect(next.seats[0]?.checkedInAt).toBe(earlier)
    expect(next.seats[1]?.checkedInAt).toBe(AT)
  })

  it("does not check in a cancelled seat", () => {
    const next = checkInSeatsInRow(party([seat({ id: "s1", status: "cancelled" })]), ["s1"], AT)
    expect(next.seats[0]?.checkedInAt).toBeNull()
    expect(rowStillPendingCheckIn(next)).toBe(false)
  })
})
