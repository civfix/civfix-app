import { describe, expect, it } from "vitest"
import type { EventSlotDTO } from "@civfix/shared"
import {
  currentShifts,
  mySlotId,
  slotBoardSummary,
  slotDisplayOrder,
  slotRemaining,
  slotRowState,
  slotViewerState,
  slotWindow,
  sortSlots,
} from "../eventSlotsModel"

function slot(over: Partial<EventSlotDTO> = {}): EventSlotDTO {
  return {
    id: "s1",
    title: "Pickers",
    description: null,
    capacity: 5,
    claimed: 0,
    sortOrder: 0,
    mine: false,
    startsAt: null,
    endsAt: null,
    ...over,
  }
}

describe("slot ownership and room edges", () => {
  it("returns the first slot flagged mine when the server flags two", () => {
    expect(mySlotId([slot({ id: "a" }), slot({ id: "b", mine: true }), slot({ id: "c", mine: true })])).toBe("b")
  })

  it("reads a zero-capacity slot as having no room", () => {
    expect(slotRemaining(slot({ capacity: 0, claimed: 0 }))).toBe(0)
    expect(slotRowState(slot({ capacity: 0 }), null, false)).toBe("full")
  })

  it("treats the slot named by the held id as mine even when the row's own flag is false", () => {
    expect(slotRowState(slot({ id: "x", mine: false, capacity: 1, claimed: 1 }), "x", false)).toBe("mine")
  })

  it("offers an unlimited slot as a switch while the viewer holds another", () => {
    expect(slotRowState(slot({ id: "b", capacity: null, claimed: 400 }), "a", false)).toBe("switch")
  })
})

describe("slotBoardSummary edges", () => {
  it("counts claims past a lowered capacity rather than clamping them", () => {
    expect(slotBoardSummary([slot({ capacity: 2, claimed: 5 })])).toEqual({ kind: "capped", claimed: 5, capacity: 2 })
  })
})

describe("slotViewerState precedence", () => {
  const base = {
    slots: [slot()],
    joined: false,
    actsAsHost: false,
    readonly: false,
    isAuthenticated: true,
    authPending: false,
  }

  it("says ended before holds on a read-only board", () => {
    expect(slotViewerState({ ...base, readonly: true, slots: [slot({ mine: true })] })).toBe("ended")
  })

  it("says host before going for a joined host who holds nothing", () => {
    expect(slotViewerState({ ...base, actsAsHost: true, joined: true })).toBe("host")
  })

  it("says going_no_slot for a joined viewer even while auth is still pending", () => {
    expect(slotViewerState({ ...base, joined: true, isAuthenticated: false, authPending: true })).toBe(
      "going_no_slot",
    )
  })
})

describe("slot windows and ordering edges", () => {
  it("accepts a window whose end is not after its start", () => {
    const reversed = slot({ startsAt: "2026-09-01T12:00:00.000Z", endsAt: "2026-09-01T10:00:00.000Z" })
    expect(slotWindow(reversed)).not.toBeNull()
    expect(currentShifts([reversed], new Date("2026-09-01T11:00:00.000Z"))).toEqual([])
  })

  it("files a slot with one unparseable end among the untimed roles", () => {
    const broken = slot({ id: "broken", title: "A", sortOrder: 0, startsAt: "nope", endsAt: "2026-09-01T10:00:00.000Z" })
    const timed = slot({
      id: "timed",
      title: "Z",
      sortOrder: 9,
      startsAt: "2026-09-01T09:00:00.000Z",
      endsAt: "2026-09-01T10:00:00.000Z",
    })
    expect(slotDisplayOrder([broken, timed]).map((s) => s.id)).toEqual(["timed", "broken"])
  })

  it("excludes the end instant of a shift", () => {
    const shift = slot({ startsAt: "2026-09-01T09:00:00.000Z", endsAt: "2026-09-01T10:00:00.000Z" })
    expect(currentShifts([shift], new Date("2026-09-01T09:59:59.999Z"))).toHaveLength(1)
    expect(currentShifts([shift], new Date("2026-09-01T10:00:00.000Z"))).toHaveLength(0)
  })

  it("orders equal sortOrder by a locale-aware title compare", () => {
    const rows = [slot({ id: "b", title: "b" }), slot({ id: "B", title: "B" }), slot({ id: "a", title: "a" })]
    expect(sortSlots(rows).map((s) => s.title)).toEqual(["a", "b", "B"])
  })
})
