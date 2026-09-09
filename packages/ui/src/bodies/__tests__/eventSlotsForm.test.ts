/**
 * The pure half of the host's signup-slot editor: draft list edits, per-draft validation and the
 * draft -> `EventSlotInput[]` build. The rules encoded here are the ones the editor cannot re-derive
 * at render time: blank rows are dropped (not errors), a move off either end is a no-op, and
 * `sortOrder` is renumbered over the SURVIVING rows.
 */
import { describe, expect, it } from "vitest"
import { MAX_SLOT_TITLE, type EventSlotDTO } from "@civfix/shared"
import {
  addSlotDraft,
  buildSlotInputs,
  claimedBySlotId,
  isBlankSlotDraft,
  makeSlotKey,
  moveSlotDraft,
  removeSlotDraft,
  removedClaimedCount,
  slotDraftError,
  slotsFromCleanup,
  slotsValid,
  updateSlotDraft,
  type SlotDraft,
} from "../eventSlotsForm"

function draft(key: string, over: Partial<SlotDraft> = {}): SlotDraft {
  return { key, title: "", description: "", capacity: "", ...over }
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
    expect(list).toEqual([{ key: "k1", title: "", description: "", capacity: "" }])
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
  it("is blank only when all three fields are empty", () => {
    expect(isBlankSlotDraft(draft("k"))).toBe(true)
    expect(isBlankSlotDraft(draft("k", { title: "  " }))).toBe(true)
    expect(isBlankSlotDraft(draft("k", { description: "note" }))).toBe(false)
    expect(isBlankSlotDraft(draft("k", { capacity: "4" }))).toBe(false)
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
      { title: "Check-in", description: null, capacity: null, sortOrder: 0 },
      { title: "Grill", description: null, capacity: 4, sortOrder: 1 },
    ])
  })

  it("keeps the server id for an existing slot and trims the description", () => {
    expect(
      buildSlotInputs([draft("a", { id: "slot-1", title: "Grill", description: "  Cook  " })]),
    ).toEqual([{ id: "slot-1", title: "Grill", description: "Cook", capacity: null, sortOrder: 0 }])
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
      { id: "s1", title: "Check-in", description: "Front table", capacity: "4" },
      { id: "s2", title: "Grill", description: "", capacity: "" },
    ])
    expect(new Set(drafts.map((d) => d.key)).size).toBe(2)
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
