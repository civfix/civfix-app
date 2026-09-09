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
    })
  })

  it("emits a header plus a placeholder for a slot nobody claimed", () => {
    const items = groupRosterBySlot([], [slot("s1", { title: "Check-in", capacity: 4 })], OPTS)
    expect(items).toEqual([
      { kind: "slot-header", slotId: "s1", title: "Check-in", claimed: 0, capacity: 4 },
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
