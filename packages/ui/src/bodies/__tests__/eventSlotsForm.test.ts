/**
 * The pure half of the host's signup-slot editor: draft list edits, per-draft validation and the
 * draft -> `EventSlotInput[]` build. The rules encoded here are the ones the editor cannot re-derive
 * at render time: blank rows are dropped (not errors), a move off either end is a no-op, and
 * `sortOrder` is renumbered over the SURVIVING rows.
 */
import { describe, expect, it } from "vitest"
import { MAX_EVENT_SLOTS, MAX_SLOT_TITLE, type EventSlotDTO } from "@civfix/shared"
import {
  addSlotDraft,
  buildSlotInputs,
  generateShiftDrafts,
  claimedBySlotId,
  isBlankSlotDraft,
  makeSlotKey,
  moveSlotDraft,
  removeSlotDraft,
  removedClaimedCount,
  slotDraftError,
  shiftSlotDrafts,
  slotsFromCleanup,
  slotsValid,
  splitCounts,
  updateSlotDraft,
  type SlotDraft,
} from "../eventSlotsForm"

function draft(key: string, over: Partial<SlotDraft> = {}): SlotDraft {
  return { key, title: "", description: "", capacity: "", startsAt: null, endsAt: null, ...over }
}

const EVENT_START = new Date("2026-06-08T16:00:00.000Z")
const EVENT_END = new Date("2026-06-08T20:00:00.000Z")
const EVENT_WINDOW = { start: EVENT_START, end: EVENT_END }

function at(offsetMinutes: number): Date {
  return new Date(EVENT_START.getTime() + offsetMinutes * 60_000)
}

function slot(id: string, over: Partial<EventSlotDTO> = {}): EventSlotDTO {
  return { id, title: `Slot ${id}`, claimed: 0, sortOrder: 0, ...over }
}

describe("makeSlotKey", () => {
  it("honours an injected seed and is monotonic otherwise", () => {
    expect(makeSlotKey(7)).toBe("slot-7")
    const a = makeSlotKey()
    const b = makeSlotKey()
    expect(a).not.toBe(b)
  })
})

describe("draft list edits", () => {
  it("appends an empty draft under the given key", () => {
    const list = addSlotDraft([], "k1")
    expect(list).toEqual([
      { key: "k1", title: "", description: "", capacity: "", startsAt: null, endsAt: null },
    ])
  })

  it("patches one draft by key and never lets the patch change the key", () => {
    const list = [draft("k1", { title: "Check-in" }), draft("k2")]
    expect(updateSlotDraft(list, "k2", { title: "Grill" })[1]).toEqual(
      draft("k2", { title: "Grill" }),
    )
    expect(updateSlotDraft(list, "k1", { key: "hijacked" } as Partial<SlotDraft>)[0]?.key).toBe("k1")
  })

  it("ignores a patch for an unknown key", () => {
    const list = [draft("k1")]
    expect(updateSlotDraft(list, "gone", { title: "x" })).toEqual(list)
  })

  it("removes by key", () => {
    expect(removeSlotDraft([draft("k1"), draft("k2")], "k1").map((d) => d.key)).toEqual(["k2"])
  })
})

describe("moveSlotDraft", () => {
  const list = [draft("a"), draft("b"), draft("c")]

  it("swaps with the neighbour in the given direction", () => {
    expect(moveSlotDraft(list, "b", -1).map((d) => d.key)).toEqual(["b", "a", "c"])
    expect(moveSlotDraft(list, "b", 1).map((d) => d.key)).toEqual(["a", "c", "b"])
  })

  it("is a no-op at BOTH ends, returning the same array reference", () => {
    expect(moveSlotDraft(list, "a", -1)).toBe(list)
    expect(moveSlotDraft(list, "c", 1)).toBe(list)
  })

  it("is a no-op for an unknown key", () => {
    expect(moveSlotDraft(list, "gone", 1)).toBe(list)
  })
})

describe("isBlankSlotDraft", () => {
  it("is blank only when ALL FIVE fields are empty", () => {
    expect(isBlankSlotDraft(draft("k"))).toBe(true)
    expect(isBlankSlotDraft(draft("k", { title: "  " }))).toBe(true)
    expect(isBlankSlotDraft(draft("k", { description: "note" }))).toBe(false)
    expect(isBlankSlotDraft(draft("k", { capacity: "4" }))).toBe(false)
    expect(isBlankSlotDraft(draft("k", { startsAt: at(0) }))).toBe(false)
    expect(isBlankSlotDraft(draft("k", { endsAt: at(60) }))).toBe(false)
  })
})

describe("slot windows", () => {
  const timed = (over: Partial<SlotDraft> = {}) =>
    draft("k", { title: "Sweep", startsAt: at(0), endsAt: at(60), ...over })

  it("accepts a window that sits inside the event", () => {
    expect(slotDraftError(timed(), undefined, EVENT_WINDOW)).toBeNull()
    expect(slotDraftError(timed({ startsAt: at(0), endsAt: at(240) }), undefined, EVENT_WINDOW)).toBeNull()
  })

  it("refuses a shift shorter than the shared 15-minute floor", () => {
    expect(slotDraftError(timed({ endsAt: at(14) }), undefined, EVENT_WINDOW)).toBe("window-too-short")
    expect(slotDraftError(timed({ endsAt: at(15) }), undefined, EVENT_WINDOW)).toBeNull()
    expect(slotDraftError(timed({ endsAt: at(-60) }), undefined, EVENT_WINDOW)).toBe("window-too-short")
  })

  it("refuses a timed slot on an event with no end, and with no window at all", () => {
    expect(slotDraftError(timed(), undefined, { start: EVENT_START, end: null })).toBe(
      "window-needs-event-end",
    )
    expect(slotDraftError(timed(), undefined, null)).toBe("window-needs-event-end")
  })

  it("refuses a shift that pokes out of either end of the event", () => {
    expect(slotDraftError(timed({ startsAt: at(-30), endsAt: at(60) }), undefined, EVENT_WINDOW)).toBe(
      "window-outside-event",
    )
    expect(slotDraftError(timed({ startsAt: at(180), endsAt: at(300) }), undefined, EVENT_WINDOW)).toBe(
      "window-outside-event",
    )
  })

  it("leaves an UNTIMED slot alone, even on an event with no end", () => {
    const untimed = draft("k", { title: "Grill" })
    expect(slotDraftError(untimed, undefined, { start: EVENT_START, end: null })).toBeNull()
    expect(slotDraftError(untimed, undefined, null)).toBeNull()
  })

  it("gates slotsValid on the same window the card paints", () => {
    const outside = [timed({ startsAt: at(-30), endsAt: at(60) })]
    expect(slotsValid(outside, undefined, EVENT_WINDOW)).toBe(false)
    expect(slotsValid([timed()], undefined, EVENT_WINDOW)).toBe(true)
  })
})

describe("shiftSlotDrafts", () => {
  it("moves every TIMED draft by the delta and leaves untimed ones untouched", () => {
    const list = [
      draft("a", { title: "Sweep", startsAt: at(0), endsAt: at(60) }),
      draft("b", { title: "Grill" }),
    ]
    const moved = shiftSlotDrafts(list, 30 * 60_000)
    expect(moved[0]?.startsAt?.toISOString()).toBe(at(30).toISOString())
    expect(moved[0]?.endsAt?.toISOString()).toBe(at(90).toISOString())
    expect(moved[1]).toBe(list[1])
  })

  it("returns the SAME array reference for a zero delta", () => {
    const list = [draft("a", { title: "Sweep", startsAt: at(0), endsAt: at(60) })]
    expect(shiftSlotDrafts(list, 0)).toBe(list)
  })
})

describe("generateShiftDrafts", () => {
  let seq = 0
  const nextKey = () => `gen-${++seq}`
  const titled = (prefix: string) => (n: number) => `${prefix.trim()} ${n}`
  const shift = titled("Shift")

  it("cuts the event into N contiguous shifts that cover the whole window", () => {
    seq = 0
    const drafts = generateShiftDrafts(EVENT_WINDOW, 4, shift, nextKey)
    expect(drafts).toHaveLength(4)
    expect(drafts[0]?.startsAt?.toISOString()).toBe(EVENT_START.toISOString())
    expect(drafts[3]?.endsAt?.toISOString()).toBe(EVENT_END.toISOString())
    for (let i = 1; i < drafts.length; i++) {
      expect(drafts[i]?.startsAt?.toISOString()).toBe(drafts[i - 1]?.endsAt?.toISOString())
    }
    expect(drafts.map((d) => d.title)).toEqual(["Shift 1", "Shift 2", "Shift 3", "Shift 4"])
    expect(drafts.every((d) => d.capacity === "" && d.description === "")).toBe(true)
    expect(new Set(drafts.map((d) => d.key)).size).toBe(4)
  })

  it("honours the prefix the host typed and rounds boundaries to the minute", () => {
    seq = 0
    const odd = { start: EVENT_START, end: new Date(EVENT_START.getTime() + 100 * 60_000 + 37_000) }
    const drafts = generateShiftDrafts(odd, 3, titled("  Crew  "), nextKey)
    expect(drafts.map((d) => d.title)).toEqual(["Crew 1", "Crew 2", "Crew 3"])
    expect(drafts[1]?.startsAt?.getSeconds()).toBe(0)
    expect(drafts[1]?.endsAt?.getSeconds()).toBe(0)
  })

  it("produces nothing for a window with no length", () => {
    seq = 0
    expect(generateShiftDrafts({ start: EVENT_START, end: EVENT_START }, 2, shift, nextKey)).toEqual(
      [],
    )
  })

  it("stays inside the same limits slotDraftError enforces", () => {
    seq = 0
    const drafts = generateShiftDrafts(EVENT_WINDOW, 2, shift, nextKey)
    expect(slotsValid(drafts, undefined, EVENT_WINDOW)).toBe(true)
  })

  it("adds nothing on a second tap: (title, window) is the uniqueness key the server enforces", () => {
    seq = 0
    const first = generateShiftDrafts(EVENT_WINDOW, 2, shift, nextKey)
    expect(first).toHaveLength(2)
    expect(generateShiftDrafts(EVENT_WINDOW, 2, shift, nextKey, first)).toEqual([])
    expect(generateShiftDrafts(EVENT_WINDOW, 2, titled("Crew"), nextKey, first)).toHaveLength(2)
  })

  it("re-adds only the shift the host deleted, not the ones still on the form", () => {
    seq = 0
    const all = generateShiftDrafts(EVENT_WINDOW, 3, shift, nextKey)
    const kept = all.filter((d) => d.title !== "Shift 2")
    const again = generateShiftDrafts(EVENT_WINDOW, 3, shift, nextKey, kept)
    expect(again.map((d) => d.title)).toEqual(["Shift 2"])
  })
})

describe("splitCounts", () => {
  const shift = (n: number) => `Shift ${n}`
  const spanning = (minutes: number) => ({
    start: EVENT_START,
    end: new Date(EVENT_START.getTime() + minutes * 60_000),
  })

  it("offers nothing without an event window", () => {
    expect(splitCounts(null, [], shift)).toEqual([])
    expect(splitCounts({ start: EVENT_START, end: EVENT_START }, [], shift)).toEqual([])
  })

  it("never offers a count whose shifts would fall under the slot minimum", () => {
    expect(splitCounts(spanning(45), [], shift)).toEqual([2, 3])
    expect(splitCounts(spanning(40), [], shift)).toEqual([2])
    expect(splitCounts(spanning(29), [], shift)).toEqual([])
    expect(splitCounts(spanning(30), [], shift)).toEqual([2])
    expect(splitCounts(EVENT_WINDOW, [], shift)).toEqual([2, 3, 4])
  })

  it("drops a count once every shift it would add already exists", () => {
    let seq = 0
    const drafts = generateShiftDrafts(EVENT_WINDOW, 2, shift, () => `gen-${++seq}`)
    expect(splitCounts(EVENT_WINDOW, drafts, shift)).toEqual([3, 4])
    expect(splitCounts(EVENT_WINDOW, drafts, (n) => `Crew ${n}`)).toEqual([2, 3, 4])
  })

  it("stays inside the per-event slot cap", () => {
    const filler = Array.from({ length: MAX_EVENT_SLOTS - 2 }, (_, i) =>
      draft(`f${i}`, { title: `Filler ${i}` }),
    )
    expect(splitCounts(EVENT_WINDOW, filler, shift)).toEqual([2])
  })
})

describe("slotDraftError", () => {
  it("returns null for a fully blank draft (a fresh card is not an error)", () => {
    expect(slotDraftError(draft("k"))).toBeNull()
  })

  it("flags a missing title once anything else is filled in", () => {
    expect(slotDraftError(draft("k", { description: "Hand out gloves" }))).toBe("empty-title")
    expect(slotDraftError(draft("k", { capacity: "4" }))).toBe("empty-title")
  })

  it("flags an over-long title", () => {
    expect(slotDraftError(draft("k", { title: "a".repeat(MAX_SLOT_TITLE) }))).toBeNull()
    expect(slotDraftError(draft("k", { title: "a".repeat(MAX_SLOT_TITLE + 1) }))).toBe(
      "title-too-long",
    )
  })

  it("accepts an empty capacity as unlimited", () => {
    expect(slotDraftError(draft("k", { title: "Check-in", capacity: "  " }))).toBeNull()
  })

  it("flags a capacity that is not a usable whole count", () => {
    for (const capacity of ["0", "-2", "2.5", "abc", "1000"]) {
      expect(slotDraftError(draft("k", { title: "Check-in", capacity }))).toBe("capacity-invalid")
    }
  })

  it("flags a capacity below the slot's existing claims", () => {
    expect(slotDraftError(draft("k", { title: "Check-in", capacity: "2" }), 3)).toBe(
      "capacity-below-claimed",
    )
    expect(slotDraftError(draft("k", { title: "Check-in", capacity: "3" }), 3)).toBeNull()
    // Unlimited can never be below the claim count.
    expect(slotDraftError(draft("k", { title: "Check-in", capacity: "" }), 3)).toBeNull()
  })
})

describe("slotsValid", () => {
  it("ignores blank drafts and rejects any authored draft with an error", () => {
    expect(slotsValid([draft("a"), draft("b", { title: "Check-in" })])).toBe(true)
    expect(slotsValid([draft("a", { title: "Check-in", capacity: "x" })])).toBe(false)
  })

  it("REJECTS a capacity lowered below that slot's live claims once the counts are supplied", () => {
    // The edit card has always PAINTED this error (SlotCard passes `claimed`); the submit gate did not,
    // so Save stayed enabled and the lowered capacity published anyway. The gate now runs the same check
    // the card runs.
    const drafts = [draft("a", { id: "s1", title: "Truck driver", capacity: "2" })]
    const claimed = claimedBySlotId([slot("s1", { capacity: 4, claimed: 4 })])
    expect(slotsValid(drafts, claimed)).toBe(false)
    expect(slotsValid(drafts)).toBe(true) // create form: no counts, unchanged behaviour
  })

  it("accepts a capacity at or above the claims, and a NEW slot the map knows nothing about", () => {
    const claimed = claimedBySlotId([slot("s1", { capacity: 4, claimed: 3 })])
    expect(slotsValid([draft("a", { id: "s1", title: "Truck driver", capacity: "3" })], claimed)).toBe(
      true,
    )
    // A draft with no server id cannot have claims - it does not exist yet.
    expect(slotsValid([draft("b", { title: "Grill", capacity: "1" })], claimed)).toBe(true)
  })
})

describe("claimedBySlotId", () => {
  it("maps each existing slot's id to its live claim count", () => {
    expect(
      claimedBySlotId([slot("s1", { claimed: 4 }), slot("s2", { claimed: 0 })]),
    ).toEqual(new Map([["s1", 4], ["s2", 0]]))
    expect(claimedBySlotId([])).toEqual(new Map())
  })
})

describe("buildSlotInputs", () => {
  it("drops fully-blank rows and numbers sortOrder by the surviving array index", () => {
    expect(
      buildSlotInputs([
        draft("a", { title: " Check-in " }),
        draft("b"),
        draft("c", { title: "Grill", capacity: "4" }),
      ]),
    ).toEqual([
      {
        title: "Check-in",
        description: null,
        capacity: null,
        sortOrder: 0,
        startsAt: null,
        endsAt: null,
      },
      {
        title: "Grill",
        description: null,
        capacity: 4,
        sortOrder: 1,
        startsAt: null,
        endsAt: null,
      },
    ])
  })

  it("keeps the server id for an existing slot and trims the description", () => {
    expect(
      buildSlotInputs([draft("a", { id: "slot-1", title: "Grill", description: "  Cook  " })]),
    ).toEqual([
      {
        id: "slot-1",
        title: "Grill",
        description: "Cook",
        capacity: null,
        sortOrder: 0,
        startsAt: null,
        endsAt: null,
      },
    ])
  })

  it("sends the window as ISO instants, and an EXPLICIT null for an untimed slot", () => {
    const [timed] = buildSlotInputs([
      draft("a", { title: "Sweep", startsAt: at(0), endsAt: at(60) }),
    ])
    expect(timed?.startsAt).toBe(EVENT_START.toISOString())
    expect(timed?.endsAt).toBe(at(60).toISOString())
    const [untimed] = buildSlotInputs([draft("b", { title: "Grill" })])
    expect(untimed?.startsAt).toBeNull()
    expect(untimed?.endsAt).toBeNull()
  })

  it("never emits a lone edge - the schema refuses one and the editor sets the pair together", () => {
    const [half] = buildSlotInputs([draft("a", { title: "Sweep", startsAt: at(0) })])
    expect(half?.startsAt).toBeNull()
    expect(half?.endsAt).toBeNull()
  })

  it("sends null capacity for an unusable draft rather than NaN", () => {
    expect(buildSlotInputs([draft("a", { title: "Grill", capacity: "x" })])[0]?.capacity).toBeNull()
  })

  it("returns an empty array when every row is blank", () => {
    expect(buildSlotInputs([draft("a"), draft("b")])).toEqual([])
  })
})

describe("slotsFromCleanup", () => {
  it("maps DTOs to drafts, stringifying capacity and defaulting a null description", () => {
    const drafts = slotsFromCleanup([
      slot("s1", { title: "Check-in", capacity: 4, description: "Front table" }),
      slot("s2", { title: "Grill", capacity: null, description: null }),
    ])
    expect(drafts.map(({ key: _key, ...rest }) => rest)).toEqual([
      {
        id: "s1",
        title: "Check-in",
        description: "Front table",
        capacity: "4",
        startsAt: null,
        endsAt: null,
      },
      { id: "s2", title: "Grill", description: "", capacity: "", startsAt: null, endsAt: null },
    ])
    expect(new Set(drafts.map((d) => d.key)).size).toBe(2)
  })

  it("round-trips a timed slot through drafts and back to the wire", () => {
    const drafts = slotsFromCleanup([
      slot("s1", {
        title: "Sweep",
        startsAt: EVENT_START.toISOString(),
        endsAt: at(60).toISOString(),
      }),
    ])
    expect(drafts[0]?.startsAt?.toISOString()).toBe(EVENT_START.toISOString())
    expect(buildSlotInputs(drafts)[0]?.endsAt).toBe(at(60).toISOString())
  })

  it("drops a half-written window rather than carrying a lone edge into the form", () => {
    const drafts = slotsFromCleanup([slot("s1", { startsAt: EVENT_START.toISOString() })])
    expect(drafts[0]?.startsAt).toBeNull()
    expect(drafts[0]?.endsAt).toBeNull()
  })
})

describe("removedClaimedCount", () => {
  const original = [slot("s1", { claimed: 2 }), slot("s2", { claimed: 3 }), slot("s3")]

  it("sums the claims of every original slot the drafts no longer keep", () => {
    expect(removedClaimedCount(original, [draft("a", { id: "s1" })])).toBe(3)
  })

  it("is zero when every claimed slot survives", () => {
    expect(
      removedClaimedCount(original, [draft("a", { id: "s1" }), draft("b", { id: "s2" })]),
    ).toBe(0)
  })

  it("ignores brand-new drafts, which have no id", () => {
    expect(removedClaimedCount([], [draft("a", { title: "New" })])).toBe(0)
  })
})
