import { QueryClient } from "@tanstack/react-query"
import type { EventRegistrationDTO, EventSeatDTO } from "@civfix/shared"
import { describe, expect, it } from "vitest"

import { checkInSeatsInRow, rowStillPendingCheckIn } from "./attendees/roster-filters"
import { invalidateOrg, markRosterSeatsCheckedIn, upsertMyOrganization } from "./console-invalidate"
import { consoleKeys } from "./console-keys"

const AT = "2026-09-06T18:00:00.000Z"

function seat(id: string, overrides: Partial<EventSeatDTO> = {}): EventSeatDTO {
  return {
    id,
    seatIndex: 0,
    status: "active",
    checkedInAt: null,
    noShowAt: null,
    ...overrides,
  }
}

function row(overrides: Partial<EventRegistrationDTO> = {}): EventRegistrationDTO {
  return {
    id: "reg_1",
    cleanupId: "evt_1",
    kind: "guest",
    guestName: "Ada",
    partySize: 3,
    seatCount: 3,
    seats: [seat("s1"), seat("s2"), seat("s3")],
    status: "registered",
    source: "self",
    registeredAt: "2026-09-01T00:00:00.000Z",
    checkedInAt: null,
    ...overrides,
  }
}

function rosterKey(filter: string) {
  return ["host", "evt_1", "roster", "console", filter, "name_asc", "", "all"]
}

function page(items: EventRegistrationDTO[], total?: number) {
  return {
    pages: [{ items, nextCursor: null, ...(total === undefined ? {} : { total }) }],
    pageParams: [undefined],
  }
}

describe("checkInSeatsInRow", () => {
  it("checks in every seat it is given", () => {
    const next = checkInSeatsInRow(row(), ["s1", "s2", "s3"], AT)
    expect(next.seats.map((s) => s.checkedInAt)).toEqual([AT, AT, AT])
    expect(next.checkedInAt).toBe(AT)
  })

  it("leaves seats it was not given alone", () => {
    const next = checkInSeatsInRow(row(), ["s1"], AT)
    expect(next.seats.map((s) => s.checkedInAt)).toEqual([AT, null, null])
    expect(rowStillPendingCheckIn(next)).toBe(true)
  })

  it("never re-stamps a seat that was already checked in", () => {
    const earlier = "2026-09-06T17:00:00.000Z"
    const next = checkInSeatsInRow(
      row({ seats: [seat("s1", { checkedInAt: earlier }), seat("s2")], seatCount: 2 }),
      ["s1", "s2"],
      AT,
    )
    expect(next.seats[0]?.checkedInAt).toBe(earlier)
    expect(next.seats[1]?.checkedInAt).toBe(AT)
  })

  it("does not check in a cancelled seat", () => {
    const next = checkInSeatsInRow(
      row({ seats: [seat("s1", { status: "cancelled" })], seatCount: 1 }),
      ["s1"],
      AT,
    )
    expect(next.seats[0]?.checkedInAt).toBeNull()
    expect(rowStillPendingCheckIn(next)).toBe(false)
  })
})

describe("markRosterSeatsCheckedIn", () => {
  it("keeps the row in the attendees list with its seats updated", () => {
    const qc = new QueryClient()
    qc.setQueryData(rosterKey("all"), page([row()], 1))
    markRosterSeatsCheckedIn(qc, "evt_1", "reg_1", ["s1", "s2", "s3"], AT)
    const data = qc.getQueryData(rosterKey("all")) as ReturnType<typeof page>
    expect(data.pages[0]?.items).toHaveLength(1)
    expect(data.pages[0]?.items[0]?.seats.every((s) => s.checkedInAt === AT)).toBe(true)
    expect(data.pages[0]?.total).toBe(1)
  })

  it("drops the row from the door list only once the whole party is in", () => {
    const qc = new QueryClient()
    qc.setQueryData(rosterKey("not_checked_in"), page([row()], 1))
    markRosterSeatsCheckedIn(qc, "evt_1", "reg_1", ["s1"], AT)
    let data = qc.getQueryData(rosterKey("not_checked_in")) as ReturnType<typeof page>
    expect(data.pages[0]?.items).toHaveLength(1)
    expect(data.pages[0]?.items[0]?.seats.map((s) => s.checkedInAt)).toEqual([AT, null, null])

    markRosterSeatsCheckedIn(qc, "evt_1", "reg_1", ["s2", "s3"], AT)
    data = qc.getQueryData(rosterKey("not_checked_in")) as ReturnType<typeof page>
    expect(data.pages[0]?.items).toHaveLength(0)
    expect(data.pages[0]?.total).toBe(0)
  })

  it("updates every roster cache for the event, not just the one on screen", () => {
    const qc = new QueryClient()
    qc.setQueryData(rosterKey("all"), page([row()]))
    qc.setQueryData(rosterKey("registered"), page([row()]))
    qc.setQueryData(rosterKey("not_checked_in"), page([row()]))
    markRosterSeatsCheckedIn(qc, "evt_1", "reg_1", ["s1", "s2", "s3"], AT)
    for (const filter of ["all", "registered"]) {
      const data = qc.getQueryData(rosterKey(filter)) as ReturnType<typeof page>
      expect(data.pages[0]?.items[0]?.checkedInAt).toBe(AT)
    }
    const door = qc.getQueryData(rosterKey("not_checked_in")) as ReturnType<typeof page>
    expect(door.pages[0]?.items).toHaveLength(0)
  })

  it("drops a settled row from the shared data layer's door list too", () => {
    const qc = new QueryClient()
    const uiDoorKey = ["host", "evt_1", "roster", "not_checked_in", ""]
    const uiSearchKey = ["host", "evt_1", "roster", "all", "not_checked_in"]
    qc.setQueryData(uiDoorKey, page([row()], 1))
    qc.setQueryData(uiSearchKey, page([row()], 1))
    markRosterSeatsCheckedIn(qc, "evt_1", "reg_1", ["s1", "s2", "s3"], AT)
    const door = qc.getQueryData(uiDoorKey) as ReturnType<typeof page>
    expect(door.pages[0]?.items).toHaveLength(0)
    const search = qc.getQueryData(uiSearchKey) as ReturnType<typeof page>
    expect(search.pages[0]?.items[0]?.checkedInAt).toBe(AT)
  })

  it("leaves another event's roster untouched", () => {
    const qc = new QueryClient()
    const otherKey = ["host", "evt_2", "roster", "console", "all", "name_asc", "", "all"]
    qc.setQueryData(rosterKey("all"), page([row()]))
    qc.setQueryData(otherKey, page([row()]))
    markRosterSeatsCheckedIn(qc, "evt_1", "reg_1", ["s1"], AT)
    const other = qc.getQueryData(otherKey) as ReturnType<typeof page>
    expect(other.pages[0]?.items[0]?.checkedInAt).toBeNull()
  })

  it("is a no-op when no seat was actually checked in", () => {
    const qc = new QueryClient()
    qc.setQueryData(rosterKey("all"), page([row()]))
    markRosterSeatsCheckedIn(qc, "evt_1", "reg_1", [], AT)
    const data = qc.getQueryData(rosterKey("all")) as ReturnType<typeof page>
    expect(data.pages[0]?.items[0]?.checkedInAt).toBeNull()
  })
})

describe("invalidateOrg", () => {
  function seed(qc: QueryClient): void {
    qc.setQueryData(consoleKeys.org("org_1"), { id: "org_1" })
    qc.setQueryData(consoleKeys.orgMembers("org_1"), { items: [], nextCursor: null })
    qc.setQueryData(consoleKeys.orgVerification("org_1"), { status: "unverified", kind: null })
    qc.setQueryData(["orgs", "mine"], [{ id: "org_1" }])
    qc.setQueryData(consoleKeys.org("org_2"), { id: "org_2" })
    qc.setQueryData(["host", "evt_1"], { id: "evt_1" })
  }

  function stale(qc: QueryClient, key: readonly unknown[]): boolean {
    return qc.getQueryState(key)?.isInvalidated === true
  }

  it("invalidates every console cache under the org AND the org list", () => {
    const qc = new QueryClient()
    seed(qc)
    invalidateOrg(qc, "org_1")
    expect(stale(qc, consoleKeys.org("org_1"))).toBe(true)
    expect(stale(qc, consoleKeys.orgMembers("org_1"))).toBe(true)
    expect(stale(qc, consoleKeys.orgVerification("org_1"))).toBe(true)
    expect(stale(qc, ["orgs", "mine"])).toBe(true)
  })

  it("leaves another org and the event caches alone", () => {
    const qc = new QueryClient()
    seed(qc)
    invalidateOrg(qc, "org_1")
    expect(stale(qc, consoleKeys.org("org_2"))).toBe(false)
    expect(stale(qc, ["host", "evt_1"])).toBe(false)
  })
})

describe("upsertMyOrganization", () => {
  const org = (over: Record<string, unknown>) =>
    ({
      id: "org_1",
      slug: "river",
      name: "River",
      verifiedStatus: "unverified",
      createdAt: "2026-09-01T00:00:00.000Z",
      ...over,
    }) as never

  it("appends a new org to the list, creating the list when there is none yet", () => {
    const qc = new QueryClient()
    upsertMyOrganization(qc, org({ myRole: "owner" }))
    expect(qc.getQueryData(["orgs", "mine"])).toEqual([org({ myRole: "owner" })])
    upsertMyOrganization(qc, org({ id: "org_2", slug: "sea", name: "Sea" }))
    expect((qc.getQueryData(["orgs", "mine"]) as unknown[]).map((row) => (row as { id: string }).id)).toEqual([
      "org_1",
      "org_2",
    ])
  })

  it("merges an existing row so the fresh DTO wins without dropping fields it lacks", () => {
    const qc = new QueryClient()
    qc.setQueryData(["orgs", "mine"], [org({ myRole: "owner", memberCount: 3 }), org({ id: "org_2" })])
    upsertMyOrganization(qc, org({ name: "River Keepers" }))
    expect(qc.getQueryData(["orgs", "mine"])).toEqual([
      org({ name: "River Keepers", myRole: "owner", memberCount: 3 }),
      org({ id: "org_2" }),
    ])
  })
})
