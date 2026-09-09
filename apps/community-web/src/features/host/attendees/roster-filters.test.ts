import type { EventRegistrationDTO, EventSeatDTO } from "@civfix/shared"
import { describe, expect, it } from "vitest"

import {
  ROSTER_FILTERS,
  attendanceOf,
  attendeeDisplayName,
  checkableSeatIds,
  checkedInSeatIds,
  isRosterFilter,
  isRosterSort,
  isWaitlistProjection,
  rosterTotals,
  rowSupportsRegistrationActions,
  shouldResetCursor,
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

const NAMES = { guest: "Guest", deleted: "Deleted user" }

describe("roster filters", () => {
  it("recognises every contract filter and sort", () => {
    for (const filter of ROSTER_FILTERS) expect(isRosterFilter(filter)).toBe(true)
    expect(isRosterFilter("nope")).toBe(false)
    expect(isRosterFilter(undefined)).toBe(false)
    expect(isRosterSort("name_asc")).toBe(true)
    expect(isRosterSort("name_desc")).toBe(false)
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

  it("splits seats into checkable and already-checked-in", () => {
    const r = row({
      seats: [
        seat({ id: "a" }),
        seat({ id: "b", checkedInAt: "2026-03-01T10:00:00.000Z" }),
        seat({ id: "c", status: "cancelled" }),
      ],
    })
    expect(checkableSeatIds(r)).toEqual(["a"])
    expect(checkedInSeatIds(r)).toEqual(["b"])
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

  it("names a member, a guest and a deleted user distinctly", () => {
    expect(attendeeDisplayName(row({ guestName: "Ann" }), NAMES)).toBe("Ann")
    expect(attendeeDisplayName(row(), NAMES)).toBe("Guest")
    expect(
      attendeeDisplayName(
        row({
          person: {
            id: "p1",
            name: "Ann",
            followers: 0,
            following: 0,
            isFollowing: false,
            deleted: true,
          },
        }),
        NAMES,
      ),
    ).toBe("Deleted user")
  })

  it("restarts pagination whenever the cursor space changes", () => {
    const base = { filter: "all", sort: "registered_at_desc", q: "", ticket: "all" }
    expect(shouldResetCursor(base, base)).toBe(false)
    expect(shouldResetCursor(base, { ...base, sort: "name_asc" })).toBe(true)
    expect(shouldResetCursor(base, { ...base, filter: "checked_in" })).toBe(true)
    expect(shouldResetCursor(base, { ...base, q: "ann" })).toBe(true)
    expect(shouldResetCursor(base, { ...base, ticket: "t1" })).toBe(true)
  })

  it("keeps the whole-event total distinct from the filtered row count", () => {
    expect(rosterTotals(12, 87, true)).toEqual({ shown: 12, eventTotal: 87, hasMore: true })
    expect(rosterTotals(12, undefined, false).eventTotal).toBeNull()
  })
})
