/**
 * The per-slot roster grouping the host sees in `MembersBody`. The rules that matter: slot order is
 * `sortOrder`, an unclaimed slot still shows a header (that gap is the point of the view), the "no
 * slot" group is LAST, and every item has a stable key for the FlatList.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type { EventRegistrationDTO, EventSlotDTO } from "@civfix/shared"
import {
  claimantsBySlot,
  groupRosterBySlot,
  rosterListKey,
  type RosterListItem,
  type RosterSlotPerson,
} from "../rosterSlotGroups"

const OPTS = { unassignedTitle: "No slot", emptySlotTitle: "Nobody yet" }

function slot(id: string, over: Partial<EventSlotDTO> = {}): EventSlotDTO {
  return { id, title: `Slot ${id}`, claimed: 0, sortOrder: 0, ...over }
}

function person(id: string, slotId?: string): RosterSlotPerson {
  return { id, slot: slotId ? { id: slotId, title: `Slot ${slotId}` } : null }
}

function shape(items: RosterListItem[]): string[] {
  return items.map((item) =>
    item.kind === "member" ? `member:${item.person.id}` : `${item.kind}:${item.slotId ?? "none"}`,
  )
}

describe("groupRosterBySlot", () => {
  const slots = [
    slot("s2", { title: "Grill", sortOrder: 1, capacity: 2 }),
    slot("s1", { title: "Check-in", sortOrder: 0, capacity: 4 }),
  ]

  it("orders slots by sortOrder with their members directly beneath", () => {
    const items = groupRosterBySlot(
      [person("p1", "s2"), person("p2", "s1"), person("p3", "s1")],
      slots,
      OPTS,
    )
    expect(shape(items)).toEqual([
      "slot-header:s1",
      "member:p2",
      "member:p3",
      "slot-header:s2",
      "member:p1",
    ])
  })

  it("puts the unassigned group LAST", () => {
    const items = groupRosterBySlot([person("p1"), person("p2", "s1")], slots, OPTS)
    expect(shape(items)).toEqual([
      "slot-header:s1",
      "member:p2",
      "slot-header:s2",
      "slot-empty:s2",
      "slot-header:none",
      "member:p1",
    ])
    expect(items.at(-2)).toEqual({
      kind: "slot-header",
      slotId: null,
      title: "No slot",
      claimed: null,
      capacity: null,
      startsAt: null,
      endsAt: null,
    })
  })

  it("emits a header plus a placeholder for a slot nobody claimed", () => {
    const items = groupRosterBySlot([], [slot("s1", { title: "Check-in", capacity: 4 })], OPTS)
    expect(items).toEqual([
      {
        kind: "slot-header",
        slotId: "s1",
        title: "Check-in",
        claimed: 0,
        capacity: 4,
        startsAt: null,
        endsAt: null,
      },
      { kind: "slot-empty", slotId: "s1", title: "Nobody yet" },
    ])
  })

  it("omits the unassigned group entirely when everyone has a slot", () => {
    const items = groupRosterBySlot([person("p1", "s1")], [slot("s1")], OPTS)
    expect(shape(items)).toEqual(["slot-header:s1", "member:p1"])
  })

  it("takes claimed from the slot board, not from the rows on this page", () => {
    const items = groupRosterBySlot([person("p1", "s1")], [slot("s1", { claimed: 9 })], OPTS)
    expect(items[0]).toMatchObject({ kind: "slot-header", claimed: 9 })
  })

  it("folds a member whose slot no longer exists into the unassigned group", () => {
    const items = groupRosterBySlot([person("p1", "gone"), person("p2")], [slot("s1")], OPTS)
    expect(shape(items)).toEqual([
      "slot-header:s1",
      "slot-empty:s1",
      "slot-header:none",
      "member:p2",
      "member:p1",
    ])
  })

  it("returns nothing for an empty roster with no slots", () => {
    expect(groupRosterBySlot([], [], OPTS)).toEqual([])
  })
})

describe("a paginated roster omits the empty-slot placeholder", () => {
  const slots = [
    slot("s1", { title: "Check-in", sortOrder: 0, capacity: 4 }),
    slot("s2", { title: "Grill", sortOrder: 1, capacity: 2 }),
  ]
  const OPEN = { unassignedTitle: "No slot" }

  it("skips a slot with no loaded members entirely - header included", () => {
    const items = groupRosterBySlot([person("p1", "s2")], slots, OPEN)
    expect(shape(items)).toEqual(["slot-header:s2", "member:p1"])
  })

  it("keeps the order, the counts and the trailing unassigned group", () => {
    const items = groupRosterBySlot([person("p1"), person("p2", "s2"), person("p3", "s1")], slots, OPEN)
    expect(shape(items)).toEqual([
      "slot-header:s1",
      "member:p3",
      "slot-header:s2",
      "member:p2",
      "slot-header:none",
      "member:p1",
    ])
  })

  it("still folds an orphan of a deleted slot into the unassigned group", () => {
    const items = groupRosterBySlot([person("p1", "gone")], slots, OPEN)
    expect(shape(items)).toEqual(["slot-header:none", "member:p1"])
  })

  it("returns nothing when no loaded row claims any slot", () => {
    expect(groupRosterBySlot([], slots, OPEN)).toEqual([])
  })

  it("leaves the placeholder behaviour untouched when a title IS supplied", () => {
    const items = groupRosterBySlot([person("p1", "s2")], slots, OPTS)
    expect(shape(items)).toEqual([
      "slot-header:s1",
      "slot-empty:s1",
      "slot-header:s2",
      "member:p1",
    ])
  })
})

describe("the header count survives paging and filtering", () => {
  const slots = [
    slot("s1", { title: "Check-in", sortOrder: 0, capacity: 40, claimed: 40 }),
    slot("s2", { title: "Grill", sortOrder: 1, capacity: 6, claimed: 5 }),
  ]
  const OPEN = { unassignedTitle: "No slot" }

  it("reports the full slot even when one row of it survived the filter", () => {
    const items = groupRosterBySlot([person("p1", "s1")], slots, OPEN)
    expect(items[0]).toMatchObject({ kind: "slot-header", claimed: 40, capacity: 40 })
  })

  it("reports the same count on every page of a long roster", () => {
    const first = groupRosterBySlot([person("p1", "s1"), person("p2", "s1")], slots, OPEN)
    const second = groupRosterBySlot([person("p3", "s1")], slots, OPEN)
    expect(first[0]).toMatchObject({ claimed: 40 })
    expect(second[0]).toMatchObject({ claimed: 40 })
  })

  it("keeps each slot on its own count when several groups are on the page", () => {
    const items = groupRosterBySlot([person("p1", "s1"), person("p2", "s2")], slots, OPEN)
    expect(items.filter((item) => item.kind === "slot-header")).toMatchObject([
      { slotId: "s1", claimed: 40 },
      { slotId: "s2", claimed: 5 },
    ])
  })

  it("carries the slot's count onto an empty-placeholder header too", () => {
    const items = groupRosterBySlot([], [slot("s1", { capacity: 4, claimed: 3 })], OPTS)
    expect(items[0]).toMatchObject({ kind: "slot-header", claimed: 3, capacity: 4 })
  })
})

describe("the no-slot group has no fraction to print", () => {
  it("leaves claimed null on the trailing group, page count or not", () => {
    const items = groupRosterBySlot([person("p1"), person("p2")], [slot("s1")], {
      unassignedTitle: "No slot",
    })
    const trailing = items.find((item) => item.kind === "slot-header" && item.slotId === null)
    expect(trailing).toMatchObject({ claimed: null, capacity: null })
  })

  it("leaves claimed null for orphans folded in from a deleted slot", () => {
    const items = groupRosterBySlot([person("p1", "gone")], [slot("s1")], {
      unassignedTitle: "No slot",
    })
    expect(items[0]).toMatchObject({ kind: "slot-header", slotId: null, claimed: null })
  })

  it("makes the header skip the count badge entirely on a null claimed", () => {
    const header = readFileSync(new URL("../SlotGroupHeader.tsx", import.meta.url), "utf8")
    expect(header).toContain("claimed: number | null")
    expect(header).toContain("{claimed == null ? null : (")
  })
})

describe("the grouping takes registration rows, not just attendees", () => {
  function registration(id: string, slotId?: string): EventRegistrationDTO {
    return {
      id,
      cleanupId: "c1",
      kind: "member",
      partySize: 1,
      seatCount: 1,
      seats: [],
      status: "registered",
      source: "self",
      registeredAt: "2026-06-08T16:00:00.000Z",
      slot: slotId ? { id: slotId, title: `Slot ${slotId}` } : null,
    }
  }

  it("groups EventRegistrationDTO rows and hands each one back unchanged", () => {
    const rows = [registration("r1", "s1"), registration("r2")]
    const items = groupRosterBySlot(rows, [slot("s1")], { unassignedTitle: "No slot" })
    expect(items.map((item) => (item.kind === "member" ? item.person.id : item.kind))).toEqual([
      "slot-header",
      "r1",
      "slot-header",
      "r2",
    ])
    const first = items[1]
    expect(first?.kind === "member" ? first.person : null).toBe(rows[0])
  })

  it("keys a registration row off the registration id", () => {
    const items = groupRosterBySlot([registration("r1", "s1")], [slot("s1")], {
      unassignedTitle: "No slot",
    })
    expect(items.map(rosterListKey)).toContain("member:r1")
  })
})

describe("rosterListKey", () => {
  it("is unique and stable across the three item kinds", () => {
    const items = groupRosterBySlot([person("p1"), person("p2", "s1")], [slot("s1"), slot("s2")], OPTS)
    const keys = items.map(rosterListKey)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toContain("slot-header:unassigned")
    expect(keys).toContain("slot-empty:s2")
    expect(keys).toContain("member:p1")
  })
})

describe("timed slots in the grouped roster", () => {
  const timed = (id: string, startMin: number, endMin: number, over: Partial<EventSlotDTO> = {}) =>
    slot(id, {
      startsAt: new Date(Date.UTC(2026, 5, 8, 16, startMin)).toISOString(),
      endsAt: new Date(Date.UTC(2026, 5, 8, 16, endMin)).toISOString(),
      ...over,
    })

  it("puts timed slots first, earliest start first, with untimed roles after them", () => {
    const slots = [
      slot("untimed", { title: "Grill", sortOrder: 0 }),
      timed("late", 120, 180, { title: "Sweep PM", sortOrder: 5 }),
      timed("early", 0, 60, { title: "Sweep AM", sortOrder: 9 }),
    ]
    const items = groupRosterBySlot([], slots, OPTS)
    expect(shape(items).filter((k) => k.startsWith("slot-header"))).toEqual([
      "slot-header:early",
      "slot-header:late",
      "slot-header:untimed",
    ])
  })

  it("carries the window onto the header so it can print the range", () => {
    const items = groupRosterBySlot([person("p1", "early")], [timed("early", 0, 60)], OPTS)
    const header = items.find((item) => item.kind === "slot-header")
    expect(header).toMatchObject({
      startsAt: new Date(Date.UTC(2026, 5, 8, 16, 0)).toISOString(),
      endsAt: new Date(Date.UTC(2026, 5, 8, 17, 0)).toISOString(),
    })
  })

  it("leaves the window null on an untimed slot and on the trailing no-slot group", () => {
    const items = groupRosterBySlot([person("p1")], [slot("s1")], OPTS)
    for (const item of items) {
      if (item.kind !== "slot-header") continue
      expect(item.startsAt).toBeNull()
      expect(item.endsAt).toBeNull()
    }
  })

  it("keeps the item keys exactly as they were", () => {
    const items = groupRosterBySlot([person("p1", "early")], [timed("early", 0, 60), slot("s2")], OPTS)
    expect(items.map(rosterListKey)).toContain("slot-header:early")
    expect(items.map(rosterListKey)).toContain("slot-empty:s2")
  })
})

describe("claimantsBySlot", () => {
  const slots = [
    slot("s2", { title: "Grill", sortOrder: 1 }),
    slot("s1", { title: "Check-in", sortOrder: 0 }),
  ]

  it("buckets each member under the header it follows, in server order", () => {
    const items = groupRosterBySlot(
      [person("p1", "s2"), person("p2", "s1"), person("p3", "s1")],
      slots,
      OPTS,
    )
    const bySlot = claimantsBySlot(items)
    expect(bySlot.get("s1")?.map((p) => p.id)).toEqual(["p2", "p3"])
    expect(bySlot.get("s2")?.map((p) => p.id)).toEqual(["p1"])
  })

  it("leaves the trailing no-slot group out - it belongs to no row", () => {
    const items = groupRosterBySlot([person("p1"), person("p2", "s1")], slots, OPTS)
    const bySlot = claimantsBySlot(items)
    expect([...bySlot.keys()]).toEqual(["s1"])
    expect(bySlot.get("s1")?.map((p) => p.id)).toEqual(["p2"])
  })

  it("drops an orphan of a deleted slot, which the grouping already folded into no-slot", () => {
    const items = groupRosterBySlot([person("p1", "gone")], slots, OPTS)
    expect([...claimantsBySlot(items).keys()]).toEqual([])
  })

  it("returns nothing for a slot an empty placeholder stands in for", () => {
    const items = groupRosterBySlot([], slots, OPTS)
    expect(claimantsBySlot(items).size).toBe(0)
  })
})
