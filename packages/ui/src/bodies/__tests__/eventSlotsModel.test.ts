/**
 * The attendee-facing slot picker's pure model. The load-bearing rules: ownership comes off
 * `slot.mine`, an unlimited slot is never full, and `mine` outranks `full` (the person who took the
 * last spot must still be able to release it).
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type { EventSlotDTO } from "@civfix/shared"
import { EVENT_ENDED_FIELD, EVENT_ENDED_REASON } from "../errorCode"
import {
  boardHasTimedSlots,
  claimSlotErrorKey,
  currentShifts,
  mySlotId,
  slotDisplayOrder,
  slotRemaining,
  slotBoardSummary,
  slotRowState,
  slotViewerState,
  slotWindow,
  slotsFilledSummary,
  sortSlots,
} from "../eventSlotsModel"

function slot(id: string, over: Partial<EventSlotDTO> = {}): EventSlotDTO {
  return { id, title: `Slot ${id}`, claimed: 0, sortOrder: 0, ...over }
}

describe("mySlotId", () => {
  it("returns the id of the slot flagged mine, or null", () => {
    expect(mySlotId([slot("a"), slot("b", { mine: true })])).toBe("b")
    expect(mySlotId([slot("a"), slot("b", { mine: false })])).toBeNull()
    expect(mySlotId([])).toBeNull()
  })
})

describe("slotRemaining", () => {
  it("returns null for an unlimited slot", () => {
    expect(slotRemaining(slot("a"))).toBeNull()
    expect(slotRemaining(slot("a", { capacity: null }))).toBeNull()
  })

  it("returns the spots left, clamped at zero when claims exceed capacity", () => {
    expect(slotRemaining(slot("a", { capacity: 4, claimed: 1 }))).toBe(3)
    expect(slotRemaining(slot("a", { capacity: 4, claimed: 4 }))).toBe(0)
    expect(slotRemaining(slot("a", { capacity: 2, claimed: 6 }))).toBe(0)
  })
})

describe("slotRowState", () => {
  it("is open when the slot has room and the viewer holds nothing", () => {
    expect(slotRowState(slot("a", { capacity: 4, claimed: 1 }), null, false)).toBe("open")
  })

  it("treats a slot with no capacity as never full", () => {
    expect(slotRowState(slot("a", { claimed: 99 }), null, false)).toBe("open")
  })

  it("is full when a capped slot has no room left", () => {
    expect(slotRowState(slot("a", { capacity: 2, claimed: 2 }), null, false)).toBe("full")
  })

  it("is mine for the viewer's own slot, even when that slot is full", () => {
    expect(slotRowState(slot("a", { capacity: 2, claimed: 2, mine: true }), "a", false)).toBe("mine")
  })

  it("is switch for another open slot while the viewer holds one", () => {
    expect(slotRowState(slot("b", { capacity: 4, claimed: 1 }), "a", false)).toBe("switch")
  })

  it("still reports full for another slot with no room, even while holding one", () => {
    expect(slotRowState(slot("b", { capacity: 1, claimed: 1 }), "a", false)).toBe("full")
  })

  it("collapses every state to readonly on a past event", () => {
    expect(slotRowState(slot("a", { mine: true }), "a", true)).toBe("readonly")
    expect(slotRowState(slot("b", { capacity: 1, claimed: 1 }), null, true)).toBe("readonly")
  })
})

describe("slotsFilledSummary", () => {
  it("sums claims and capacities", () => {
    expect(
      slotsFilledSummary([
        slot("a", { capacity: 4, claimed: 2 }),
        slot("b", { capacity: 2, claimed: 1 }),
      ]),
    ).toEqual({ claimed: 3, capacity: 6 })
  })

  it("reports a null capacity when ANY slot is unlimited", () => {
    expect(
      slotsFilledSummary([slot("a", { capacity: 4, claimed: 2 }), slot("b", { claimed: 5 })]),
    ).toEqual({ claimed: 7, capacity: null })
  })

  it("is zero/zero for no slots", () => {
    expect(slotsFilledSummary([])).toEqual({ claimed: 0, capacity: 0 })
  })
})

describe("sortSlots", () => {
  it("sorts by sortOrder, then title, without mutating the input", () => {
    const input = [
      slot("a", { title: "Zebra", sortOrder: 1 }),
      slot("b", { title: "Apple", sortOrder: 1 }),
      slot("c", { title: "Middle", sortOrder: 0 }),
    ]
    expect(sortSlots(input).map((s) => s.id)).toEqual(["c", "b", "a"])
    expect(input.map((s) => s.id)).toEqual(["a", "b", "c"])
  })
})

const DAY = "2026-09-12"
const at = (clock: string): string => `${DAY}T${clock}:00.000Z`

describe("slotWindow", () => {
  it("is null unless BOTH ends are present and parseable", () => {
    expect(slotWindow(slot("a"))).toBeNull()
    expect(slotWindow(slot("a", { startsAt: at("09:00") }))).toBeNull()
    expect(slotWindow(slot("a", { endsAt: at("10:00") }))).toBeNull()
    expect(slotWindow(slot("a", { startsAt: null, endsAt: null }))).toBeNull()
    expect(slotWindow(slot("a", { startsAt: "not-a-date", endsAt: at("10:00") }))).toBeNull()
  })

  it("returns the parsed instants of a timed shift", () => {
    const window = slotWindow(slot("a", { startsAt: at("09:00"), endsAt: at("10:00") }))
    expect(window?.start.toISOString()).toBe(at("09:00"))
    expect(window?.end.toISOString()).toBe(at("10:00"))
  })
})

describe("boardHasTimedSlots", () => {
  it("is true as soon as ONE slot carries a window", () => {
    expect(boardHasTimedSlots([])).toBe(false)
    expect(boardHasTimedSlots([slot("a"), slot("b")])).toBe(false)
    expect(
      boardHasTimedSlots([slot("a"), slot("b", { startsAt: at("09:00"), endsAt: at("10:00") })]),
    ).toBe(true)
  })
})

describe("slotDisplayOrder", () => {
  it("puts timed shifts in clock order ahead of the untimed roles", () => {
    const input = [
      slot("grill", { title: "Grill", sortOrder: 0 }),
      slot("sort", { title: "Sort", sortOrder: 3, startsAt: at("10:00"), endsAt: at("12:00") }),
      slot("sweep", { title: "Sweep", sortOrder: 2, startsAt: at("09:00"), endsAt: at("10:00") }),
      slot("greet", { title: "Greet", sortOrder: 1 }),
    ]
    expect(slotDisplayOrder(input).map((s) => s.id)).toEqual(["sweep", "sort", "grill", "greet"])
    expect(input.map((s) => s.id)).toEqual(["grill", "sort", "sweep", "greet"])
  })

  it("breaks a shared start time on sortOrder, then title", () => {
    const window = { startsAt: at("09:00"), endsAt: at("10:00") }
    const input = [
      slot("a", { title: "Zebra", sortOrder: 1, ...window }),
      slot("b", { title: "Apple", sortOrder: 1, ...window }),
      slot("c", { title: "Middle", sortOrder: 0, ...window }),
    ]
    expect(slotDisplayOrder(input).map((s) => s.id)).toEqual(["c", "b", "a"])
  })

  it("is NOT what sortSlots does: the host's own order survives where the clock does not rule", () => {
    const input = [
      slot("grill", { title: "Grill", sortOrder: 0 }),
      slot("sweep", { title: "Sweep", sortOrder: 2, startsAt: at("09:00"), endsAt: at("10:00") }),
    ]
    expect(sortSlots(input).map((s) => s.id)).toEqual(["grill", "sweep"])
    expect(slotDisplayOrder(input).map((s) => s.id)).toEqual(["sweep", "grill"])
  })

  it("is what the attendee board, the shifts panel and the roster all read", () => {
    for (const rel of [
      "../EventSlotsBlock.tsx",
      "../rosterSlotGroups.ts",
      "../host/HostInsightsPanels.tsx",
      "../host/dashboard/NextUpCard.tsx",
    ]) {
      expect(readFileSync(new URL(rel, import.meta.url), "utf8"), rel).toContain(
        "slotDisplayOrder(",
      )
    }
  })
})

describe("currentShifts", () => {
  const sweep = slot("sweep", { startsAt: at("09:00"), endsAt: at("10:00") })
  const sort = slot("sort", { startsAt: at("10:00"), endsAt: at("12:00") })
  const grill = slot("grill")

  it("returns the shifts whose window contains the instant", () => {
    expect(currentShifts([sweep, sort, grill], new Date(at("09:30"))).map((s) => s.id)).toEqual([
      "sweep",
    ])
  })

  it("hands the boundary to the shift that is starting, never to the one that just ended", () => {
    expect(currentShifts([sweep, sort], new Date(at("10:00"))).map((s) => s.id)).toEqual(["sort"])
  })

  it("is empty before the first shift, after the last, and on an untimed board", () => {
    expect(currentShifts([sweep, sort], new Date(at("08:59")))).toEqual([])
    expect(currentShifts([sweep, sort], new Date(at("12:00")))).toEqual([])
    expect(currentShifts([grill], new Date(at("09:30")))).toEqual([])
  })
})

describe("claimSlotErrorKey (the claim/switch/release failure toast copy)", () => {
  const endedFields = { [EVENT_ENDED_FIELD]: EVENT_ENDED_REASON }

  it("tells an ENDED event apart from a slot that just filled up - both arrive as a bare 409", () => {
    expect(claimSlotErrorKey("CONFLICT", endedFields)).toBe("error.ended")
    expect(claimSlotErrorKey("CONFLICT")).toBe("error.full")
    expect(claimSlotErrorKey("CONFLICT", {})).toBe("error.full")
    expect(claimSlotErrorKey("CONFLICT", undefined)).toBe("error.full")
  })

  it("reads the ended marker whatever code carries it, and falls back to the generic line", () => {
    expect(claimSlotErrorKey(undefined, endedFields)).toBe("error.ended")
    expect(claimSlotErrorKey("FORBIDDEN")).toBe("error.generic")
    expect(claimSlotErrorKey("NOT_FOUND")).toBe("error.generic")
    expect(claimSlotErrorKey(undefined)).toBe("error.generic")
  })

  it("returns keys that en/event-slots.json actually has - nothing here goes through a t() the checker sees", () => {
    const catalog = JSON.parse(
      readFileSync(new URL("../../i18n/locales/en/event-slots.json", import.meta.url), "utf8"),
    ) as { error: Record<string, string> }
    for (const key of ["error.ended", "error.full", "error.generic"]) {
      expect(catalog.error[key.slice("error.".length)], key).toBeTypeOf("string")
    }
  })

  it("is what EventSlotsBlock maps its failure toast through", () => {
    const source = readFileSync(new URL("../EventSlotsBlock.tsx", import.meta.url), "utf8")
    expect(source).toContain("claimSlotErrorKey(code, appErrorFields(err))")
  })
})

describe("slotBoardSummary", () => {
  it("is capped only when EVERY slot has a capacity, and sums them", () => {
    const summary = slotBoardSummary([
      slot("a", { capacity: 4, claimed: 3 }),
      slot("b", { capacity: 8, claimed: 3 }),
    ])
    expect(summary).toEqual({ kind: "capped", claimed: 6, capacity: 12 })
  })

  it("refuses to sum a board where anything is unlimited", () => {
    const summary = slotBoardSummary([
      slot("a", { capacity: 4, claimed: 3 }),
      slot("b", { claimed: 5 }),
    ])
    expect(summary).toEqual({ kind: "open", claimed: 8, capacity: null })
  })

  it("reports an empty board as open with nothing claimed", () => {
    expect(slotBoardSummary([])).toEqual({ kind: "open", claimed: 0, capacity: null })
  })

  it("is honest about a capped board nobody has signed up for", () => {
    expect(slotBoardSummary([slot("a", { capacity: 12 })])).toEqual({
      kind: "capped",
      claimed: 0,
      capacity: 12,
    })
  })
})

describe("slotViewerState", () => {
  const base = {
    slots: [slot("a")],
    joined: false,
    actsAsHost: false,
    readonly: false,
    isAuthenticated: true,
    authPending: false,
  }

  it("says nothing actionable about a read-only board", () => {
    expect(slotViewerState({ ...base, readonly: true })).toBe("ended")
    expect(
      slotViewerState({ ...base, readonly: true, slots: [slot("a", { mine: true })] }),
    ).toBe("ended")
  })

  it("puts holding a slot above every role", () => {
    const slots = [slot("a"), slot("b", { mine: true })]
    expect(slotViewerState({ ...base, slots, joined: true })).toBe("holds")
    expect(slotViewerState({ ...base, slots, actsAsHost: true })).toBe("holds")
  })

  it("never nags a host who is organising rather than signing up", () => {
    expect(slotViewerState({ ...base, actsAsHost: true, joined: true })).toBe("host")
  })

  it("nudges a member who holds nothing", () => {
    expect(slotViewerState({ ...base, joined: true })).toBe("going_no_slot")
  })

  it("offers the guest line only once auth has RESOLVED to signed-out", () => {
    expect(slotViewerState({ ...base, isAuthenticated: false, authPending: false })).toBe(
      "signed_out",
    )
    expect(slotViewerState({ ...base, isAuthenticated: false, authPending: true })).toBe("not_going")
  })

  it("treats a signed-in non-member as simply not going yet", () => {
    expect(slotViewerState(base)).toBe("not_going")
  })
})
