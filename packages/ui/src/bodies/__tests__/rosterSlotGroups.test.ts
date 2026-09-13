/**
 * The per-slot roster grouping the host sees in `MembersBody`. The rules that matter: slot order is
 * `sortOrder`, an unclaimed slot still shows a header (that gap is the point of the view), the "no
 * slot" group is LAST, and every item has a stable key for the FlatList.
 */
import { describe, expect, it } from "vitest"
import type { EventSlotDTO } from "@civfix/shared"
import {
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
      claimed: 1,
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

  it("counts the members actually present, not the DTO's claimed field", () => {
    const items = groupRosterBySlot([person("p1", "s1")], [slot("s1", { claimed: 9 })], OPTS)
    expect(items[0]).toMatchObject({ kind: "slot-header", claimed: 1 })
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
