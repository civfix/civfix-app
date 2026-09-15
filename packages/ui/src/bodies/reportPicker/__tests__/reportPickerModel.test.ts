import { describe, expect, it } from "vitest"
import { MAX_LINKED_REPORTS, type BBox, type LinkedReportRef, type ReportPinDTO } from "@civfix/shared"
import type { LinkedReportCardEntry } from "../../linkedReportCards"
import {
  PICKER_MAX_FETCH_SPAN_DEG,
  PICKER_MAX_PINS,
  bboxContains,
  bboxHolds,
  cardToPin,
  categoryCounts,
  isChosen,
  mapPinsFor,
  matchesQuery,
  mergePins,
  optimisticLinkedRefs,
  pickerAction,
  pickerFetchRegion,
  pickerListItems,
  pickerListState,
  pickerRows,
  pickerSections,
  pinPresentation,
  pinState,
  pinTapIntent,
  refFromCard,
  refToPin,
  rowIndexOf,
  selectionDiff,
  shouldRefetch,
  togglePickerId,
} from "../reportPickerModel"

const LA = { lat: 34.0522, lng: -118.2437 }
const VIEW: BBox = { west: -118.26, east: -118.23, south: 34.04, north: 34.065 }

function pin(id: string, over: Partial<ReportPinDTO> = {}): ReportPinDTO {
  return { id, category: "trash", status: "published", lat: LA.lat, lng: LA.lng, ...over }
}

function north(meters: number): number {
  return LA.lat + meters / 111_320
}

const ALL = new Set<ReportPinDTO["category"]>([
  "trash",
  "recycling",
  "graffiti",
  "hazard",
  "water",
  "encampment",
  "other",
])

describe("pinState + presentation", () => {
  it("derives the four states from the chosen ids and the baseline", () => {
    const ids = new Set(["a", "c"])
    const linked = new Set(["a", "b"])
    expect(pinState("a", ids, linked)).toBe("linked")
    expect(pinState("b", ids, linked)).toBe("unlinking")
    expect(pinState("c", ids, linked)).toBe("selected")
    expect(pinState("d", ids, linked)).toBe("idle")
  })

  it("draws a selected pin active with a check, a linked pin muted with a check", () => {
    expect(pinPresentation("selected", false)).toEqual({ active: true, badge: "check", muted: false })
    expect(pinPresentation("linked", false)).toEqual({ active: false, badge: "check", muted: true })
    expect(pinPresentation("linked", true)).toEqual({ active: true, badge: "check", muted: false })
    expect(pinPresentation("unlinking", false)).toEqual({ active: false, badge: null, muted: false })
    expect(pinPresentation("idle", true)).toEqual({ active: true, badge: null, muted: false })
  })

  it("treats selected and linked as chosen", () => {
    expect(isChosen("selected")).toBe(true)
    expect(isChosen("linked")).toBe(true)
    expect(isChosen("unlinking")).toBe(false)
    expect(isChosen("idle")).toBe(false)
  })
})

describe("fetch region", () => {
  it("pads the viewport by half its size on each side and rounds to 3 decimals", () => {
    const region = pickerFetchRegion(VIEW)
    expect(region).toEqual({ west: -118.275, east: -118.215, south: 34.028, north: 34.078 })
  })

  it("refuses a viewport wider than the pin span cap", () => {
    const wide: BBox = { west: -119, east: -118, south: 34, north: 34.2 }
    expect(PICKER_MAX_FETCH_SPAN_DEG).toBeLessThan(1)
    expect(pickerFetchRegion(wide)).toBeNull()
  })

  it("refuses a degenerate viewport", () => {
    expect(pickerFetchRegion({ west: 0, east: 0, south: 0, north: 1 })).toBeNull()
  })

  it("refetches only when the viewport leaves the loaded region", () => {
    const loaded = pickerFetchRegion(VIEW)
    expect(shouldRefetch(VIEW, null)).toBe(true)
    expect(shouldRefetch(VIEW, loaded)).toBe(false)
    const panned: BBox = { ...VIEW, west: VIEW.west - 0.1, east: VIEW.east - 0.1 }
    expect(shouldRefetch(panned, loaded)).toBe(true)
  })

  it("bbox helpers", () => {
    expect(bboxContains(VIEW, VIEW)).toBe(true)
    expect(bboxContains(VIEW, { ...VIEW, north: VIEW.north + 0.001 })).toBe(false)
    expect(bboxHolds(VIEW, LA)).toBe(true)
    expect(bboxHolds(VIEW, { lat: 35, lng: LA.lng })).toBe(false)
  })
})

describe("pins", () => {
  it("merges groups by id, later groups winning, dropping non-finite points", () => {
    const merged = mergePins(
      [pin("a", { title: "old" }), pin("bad", { lat: Number.NaN })],
      [pin("a", { title: "new" }), pin("b")],
    )
    expect(merged.map((p) => p.id)).toEqual(["a", "b"])
    expect(merged[0]?.title).toBe("new")
  })

  it("converts a linked ref and a cached card into a pin", () => {
    const ref: LinkedReportRef = {
      id: "r",
      category: "hazard",
      status: "published",
      title: "Nails",
      lat: 1,
      lng: 2,
      linkedAt: "2026-01-01T00:00:00.000Z",
      addr: "1 Main",
    }
    expect(refToPin(ref)).toEqual({
      id: "r",
      category: "hazard",
      status: "published",
      lat: 1,
      lng: 2,
      title: "Nails",
      addr: "1 Main",
    })
    const card: LinkedReportCardEntry = {
      id: "c",
      category: "water",
      status: null,
      lat: 3,
      lng: 4,
      referenceCode: "WA-1",
    }
    expect(cardToPin(card)).toEqual({
      id: "c",
      category: "water",
      status: "published",
      lat: 3,
      lng: 4,
      referenceCode: "WA-1",
    })
  })

  it("matches every token across title, detail, address and reference", () => {
    const p = pin("a", { title: "TV dumped", description: "by the alley", addr: "5th St", referenceCode: "DU-42" })
    expect(matchesQuery(p, "")).toBe(true)
    expect(matchesQuery(p, "alley tv")).toBe(true)
    expect(matchesQuery(p, "du-42")).toBe(true)
    expect(matchesQuery(p, "5th")).toBe(true)
    expect(matchesQuery(p, "couch")).toBe(false)
  })

  it("counts categories inside the viewport only", () => {
    const counts = categoryCounts(
      [pin("a"), pin("b", { category: "hazard" }), pin("c", { lat: 40 })],
      VIEW,
    )
    expect(counts).toEqual({ trash: 1, hazard: 1 })
  })

  it("keeps baseline pins on the map even when their layer is off, and caps the total", () => {
    const pins = [pin("keep", { category: "hazard" }), ...Array.from({ length: 5 }, (_u, i) => pin(`p${i}`))]
    const shown = mapPinsFor(pins, new Set(["keep"]), new Set(["trash"]), 3)
    expect(shown.map((p) => p.id)).toEqual(["keep", "p0", "p1"])
    expect(PICKER_MAX_PINS).toBeGreaterThanOrEqual(200)
  })
})

describe("rows", () => {
  const pins = [
    pin("far-linked", { lat: north(3000) }),
    pin("near", { lat: north(100) }),
    pin("mid", { lat: north(900), category: "graffiti" }),
    pin("out-of-view", { lat: north(6000), title: "couch on sidewalk" }),
    pin("unlinking", { lat: north(50) }),
  ]
  const base = {
    pins,
    center: LA,
    viewport: { west: -118.3, east: -118.2, south: 34.0, north: north(4000) },
    ids: new Set(["far-linked", "near"]),
    linked: new Set(["far-linked", "unlinking"]),
    categories: ALL,
    nearbyOnly: false,
    radiusM: 500,
    query: "",
  }

  it("lists in-view pins sorted by distance, baseline pins always, out-of-view pins never", () => {
    const rows = pickerRows(base)
    expect(rows.map((r) => [r.pin.id, r.state, r.place])).toEqual([
      ["unlinking", "unlinking", "linked"],
      ["near", "selected", "view"],
      ["mid", "idle", "view"],
      ["far-linked", "linked", "linked"],
    ])
  })

  it("filters idle pins by layer and by the nearby radius but never drops a chosen or baseline pin", () => {
    const rows = pickerRows({ ...base, categories: new Set(["graffiti"]), nearbyOnly: true })
    expect(rows.map((r) => r.pin.id)).toEqual(["unlinking", "near", "far-linked"])
    const nearby = pickerRows({ ...base, nearbyOnly: true })
    expect(nearby.map((r) => r.pin.id)).toEqual(["unlinking", "near", "far-linked"])
    const wide = pickerRows({ ...base, categories: new Set(["graffiti"]) })
    expect(wide.map((r) => r.pin.id)).toEqual(["unlinking", "near", "mid", "far-linked"])
  })

  it("keeps a selected pin in the view section even after the map pans away from it", () => {
    const rows = pickerRows({
      ...base,
      viewport: { west: -118.3, east: -118.2, south: 34.065, north: 34.1 },
    })
    expect(rows.map((r) => [r.pin.id, r.place])).toEqual([
      ["unlinking", "linked"],
      ["near", "view"],
      ["far-linked", "linked"],
    ])
  })

  it("a text query reaches beyond the view and files those hits as elsewhere", () => {
    const rows = pickerRows({ ...base, query: "couch" })
    expect(rows.map((r) => [r.pin.id, r.place])).toEqual([["out-of-view", "elsewhere"]])
  })

  it("groups rows into sections and flattens them with headers", () => {
    const sections = pickerSections(pickerRows(base))
    expect(sections.linked.map((r) => r.pin.id)).toEqual(["unlinking", "far-linked"])
    expect(sections.view.map((r) => r.pin.id)).toEqual(["near", "mid"])
    expect(sections.elsewhere).toEqual([])
    const items = pickerListItems(sections)
    expect(items.map((i) => i.key)).toEqual(["h:linked", "r:unlinking", "r:far-linked", "h:view", "r:near", "r:mid"])
    expect(rowIndexOf(items, "near")).toBe(4)
    expect(rowIndexOf(items, "nope")).toBe(-1)
  })
})

describe("selection + footer", () => {
  it("diffs the working ids against the baseline", () => {
    const diff = selectionDiff(["a", "c"], new Set(["a", "b"]))
    expect(diff).toEqual({ selected: 2, added: 1, removed: 1, dirty: true })
    expect(selectionDiff(["a"], new Set(["a"])).dirty).toBe(false)
  })

  it("picks Done when clean, Link N in the draft, Save changes when committing", () => {
    const clean = selectionDiff(["a"], new Set(["a"]))
    const dirty = selectionDiff(["a", "b"], new Set(["a"]))
    expect(pickerAction("draft", clean, false)).toEqual({ key: "action_done", count: 1, enabled: true })
    expect(pickerAction("draft", dirty, false)).toEqual({ key: "action_link", count: 2, enabled: true })
    expect(pickerAction("commit", dirty, false)).toEqual({ key: "action_save", count: 2, enabled: true })
    expect(pickerAction("commit", dirty, true).enabled).toBe(false)
  })

  it("toggles ids and refuses past the cap", () => {
    expect(togglePickerId(["a"], "b")).toEqual({ ids: ["a", "b"], outcome: "added" })
    expect(togglePickerId(["a", "b"], "a")).toEqual({ ids: ["b"], outcome: "removed" })
    const full = Array.from({ length: MAX_LINKED_REPORTS }, (_u, i) => `r${i}`)
    expect(togglePickerId(full, "extra").outcome).toBe("at_limit")
  })

  it("a first pin tap focuses, a second tap on the focused pin toggles", () => {
    expect(pinTapIntent("a", null)).toBe("focus")
    expect(pinTapIntent("a", "b")).toBe("focus")
    expect(pinTapIntent("a", "a")).toBe("toggle")
  })

  it("builds optimistic linked refs from kept refs and cached cards, skipping unknown ids", () => {
    const kept: LinkedReportRef = {
      id: "a",
      category: "trash",
      status: "published",
      title: "A",
      lat: 1,
      lng: 1,
      linkedAt: "2026-01-01T00:00:00.000Z",
    }
    const card: LinkedReportCardEntry = { id: "b", category: "hazard", status: "published", lat: 2, lng: 2, title: "B" }
    const refs = optimisticLinkedRefs(["b", "a", "ghost"], [kept], { b: card }, "2026-02-02T00:00:00.000Z")
    expect(refs.map((r) => r.id)).toEqual(["b", "a"])
    expect(refs[0]).toEqual(refFromCard(card, "2026-02-02T00:00:00.000Z"))
    expect(refs[1]).toBe(kept)
  })
})

describe("list state", () => {
  const ok = { hasRegion: true, pending: false, error: false, pinCount: 3, layerCount: 7, rowCount: 3 }
  it("prefers rows, then error, then loading, then zoom, then layers, then empty", () => {
    expect(pickerListState(ok)).toBe("rows")
    expect(pickerListState({ ...ok, rowCount: 0, error: true })).toBe("error")
    expect(pickerListState({ ...ok, rowCount: 0, pinCount: 0, pending: true })).toBe("loading")
    expect(pickerListState({ ...ok, rowCount: 0, hasRegion: false })).toBe("too_wide")
    expect(pickerListState({ ...ok, rowCount: 0, layerCount: 0 })).toBe("no_layers")
    expect(pickerListState({ ...ok, rowCount: 0 })).toBe("empty")
  })
})
