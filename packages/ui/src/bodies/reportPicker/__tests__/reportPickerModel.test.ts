import { describe, expect, it } from "vitest"
import { MAX_LINKED_REPORTS, type BBox, type LinkedReportRef, type ReportPinDTO } from "@civfix/shared"
import type { LinkedReportCardEntry } from "../../linkedReportCards"
import {
  PICKER_MAX_FETCH_SPAN_DEG,
  PICKER_MAX_PINS,
  PICKER_PAGE_FIRST,
  PICKER_PAGE_STEP,
  QUERY_RANK,
  bboxContains,
  bboxHolds,
  cardToPin,
  categoryCounts,
  isChosen,
  loadMoreState,
  mapPinsFor,
  matchesQuery,
  mergePins,
  nextPageSize,
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
  queryRank,
  refFromCard,
  refToPin,
  reportLookupKey,
  reportShortCode,
  rowIndexOf,
  rowOrdinalOf,
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

  it("a text query reaches beyond the view and files every hit into one ranked matches section", () => {
    const rows = pickerRows({ ...base, query: "couch" })
    expect(rows.map((r) => [r.pin.id, r.place])).toEqual([["out-of-view", "matches"]])
  })

  it("groups rows into sections and flattens them with headers", () => {
    const sections = pickerSections(pickerRows(base))
    expect(sections.linked.map((r) => r.pin.id)).toEqual(["unlinking", "far-linked"])
    expect(sections.view.map((r) => r.pin.id)).toEqual(["near", "mid"])
    expect(sections.matches).toEqual([])
    const { items, shown, total } = pickerListItems(sections)
    expect(items.map((i) => i.key)).toEqual(["h:linked", "r:unlinking", "r:far-linked", "h:view", "r:near", "r:mid"])
    expect([shown, total]).toEqual([4, 4])
    expect(rowIndexOf(items, "near")).toBe(4)
    expect(rowOrdinalOf(items, "near")).toBe(2)
    expect(rowIndexOf(items, "nope")).toBe(-1)
    expect(rowOrdinalOf(items, "nope")).toBe(-1)
  })
})

describe("ranking by the typed text", () => {
  const UUID = "0f6c2b1e-3d4a-4c5b-9e7f-1a2b3c4d5e6f"
  const p = pin(UUID, {
    title: "Couch dumped on Union Ave",
    description: "brown sofa",
    addr: "500 Union Ave",
    referenceCode: "DU-4-000016",
  })

  it("scores exact id first, id prefix next, then title prefix, title word, title contains, other fields", () => {
    expect(queryRank(p, "du-4-000016")).toBe(QUERY_RANK.exactId)
    expect(queryRank(p, UUID.toUpperCase())).toBe(QUERY_RANK.exactId)
    expect(queryRank(p, "DU-4")).toBe(QUERY_RANK.idPrefix)
    expect(queryRank(p, "0f6c2b1e")).toBe(QUERY_RANK.idPrefix)
    expect(queryRank(p, "couch dum")).toBe(QUERY_RANK.titlePrefix)
    expect(queryRank(p, "union dumped")).toBe(QUERY_RANK.titleWord)
    expect(queryRank(p, "nion")).toBe(QUERY_RANK.titleContains)
    expect(queryRank(p, "sofa")).toBe(QUERY_RANK.otherFields)
    expect(queryRank(p, "000016")).toBe(QUERY_RANK.otherFields)
    expect(queryRank(p, "bicycle")).toBeNull()
    expect(queryRank(p, "")).toBe(QUERY_RANK.otherFields)
  })

  it("orders rows by rank, then distance, only while something is typed", () => {
    const pins = [
      pin("far-exact", { lat: north(5000), referenceCode: "GR-4-000009", title: "tags" }),
      pin("near-title", { lat: north(100), title: "GR-4 tags on the wall" }),
      pin("mid-prefix", { lat: north(900), referenceCode: "GR-4-000001" }),
      pin("near-prefix", { lat: north(200), referenceCode: "GR-4-000002" }),
    ]
    const base = {
      pins,
      center: LA,
      viewport: { west: -118.3, east: -118.2, south: 34.0, north: north(1000) },
      ids: new Set<string>(),
      linked: new Set<string>(),
      categories: ALL,
      nearbyOnly: false,
      radiusM: 500,
      query: "GR-4-000009",
    }
    expect(pickerRows(base).map((r) => r.pin.id)).toEqual(["far-exact"])
    expect(pickerRows({ ...base, query: "gr-4" }).map((r) => r.pin.id)).toEqual([
      "near-prefix",
      "mid-prefix",
      "far-exact",
      "near-title",
    ])
    expect(pickerRows({ ...base, query: "" }).map((r) => r.pin.id)).toEqual(["near-title", "near-prefix", "mid-prefix"])
  })

  it("recognises a pasted full uuid or reference code as a lookup key, normalised", () => {
    expect(reportLookupKey(` ${UUID.toUpperCase()} `)).toBe(UUID)
    expect(reportLookupKey("du-4-000016")).toBe("DU-4-000016")
    expect(reportLookupKey("DU-4")).toBeNull()
    expect(reportLookupKey("0f6c2b1e")).toBeNull()
    expect(reportLookupKey("couch")).toBeNull()
  })

  it("prints the reference as the short code, or the first eight uuid characters", () => {
    expect(reportShortCode(p)).toBe("#DU-4-000016")
    expect(reportShortCode({ id: UUID })).toBe("#0f6c2b1e")
    expect(reportShortCode({ id: UUID, referenceCode: "  " })).toBe("#0f6c2b1e")
  })
})

describe("paging", () => {
  const rows = Array.from({ length: 11 }, (_u, i) => pin(`p${String(i).padStart(2, "0")}`, { lat: north(i * 10) }))
  const sections = pickerSections(
    pickerRows({
      pins: rows,
      center: LA,
      viewport: { west: -118.3, east: -118.2, south: 34.0, north: north(1000) },
      ids: new Set(["p10"]),
      linked: new Set(["p10"]),
      categories: ALL,
      nearbyOnly: false,
      radiusM: 500,
      query: "",
    }),
  )

  it("starts with a first page, appends three per tap and stops at the total", () => {
    expect(PICKER_PAGE_FIRST).toBe(8)
    expect(PICKER_PAGE_STEP).toBe(3)
    const first = pickerListItems(sections, PICKER_PAGE_FIRST)
    expect([first.shown, first.total]).toEqual([8, 11])
    expect(first.items.filter((i) => i.kind === "header").map((i) => i.key)).toEqual(["h:linked", "h:view"])
    expect(nextPageSize(8, 11)).toBe(11)
    expect(nextPageSize(11, 11)).toBe(11)
    const second = pickerListItems(sections, nextPageSize(8, 11))
    expect(second.shown).toBe(11)
    expect(second.items.filter((i) => i.kind === "row")).toHaveLength(11)
  })

  it("keeps section headers counting the whole section while the rows are truncated", () => {
    const page = pickerListItems(sections, 2)
    expect(page.items).toEqual([
      { kind: "header", key: "h:linked", place: "linked", count: 1 },
      expect.objectContaining({ key: "r:p10" }),
      { kind: "header", key: "h:view", place: "view", count: 10 },
      expect.objectContaining({ key: "r:p00" }),
    ])
  })

  it("shows the button while rows remain, fetches another page only during a search, then hides", () => {
    expect(loadMoreState({ shown: 8, total: 11, searching: false, hasNextPage: false, fetchingNextPage: false })).toBe("more")
    expect(loadMoreState({ shown: 11, total: 11, searching: false, hasNextPage: true, fetchingNextPage: false })).toBe("hidden")
    expect(loadMoreState({ shown: 11, total: 11, searching: true, hasNextPage: true, fetchingNextPage: false })).toBe("fetch")
    expect(loadMoreState({ shown: 11, total: 11, searching: true, hasNextPage: true, fetchingNextPage: true })).toBe("loading")
    expect(loadMoreState({ shown: 11, total: 11, searching: true, hasNextPage: false, fetchingNextPage: false })).toBe("hidden")
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
  const ok = {
    hasRegion: true,
    pending: false,
    error: false,
    searching: false,
    pinCount: 3,
    layerCount: 7,
    rowCount: 3,
  }
  it("prefers rows, then error, then loading, then no match, then zoom, then layers, then empty", () => {
    expect(pickerListState(ok)).toBe("rows")
    expect(pickerListState({ ...ok, rowCount: 0, error: true })).toBe("error")
    expect(pickerListState({ ...ok, rowCount: 0, pinCount: 0, pending: true })).toBe("loading")
    expect(pickerListState({ ...ok, rowCount: 0, searching: true, pending: true })).toBe("loading")
    expect(pickerListState({ ...ok, rowCount: 0, searching: true })).toBe("no_match")
    expect(pickerListState({ ...ok, rowCount: 0, hasRegion: false })).toBe("too_wide")
    expect(pickerListState({ ...ok, rowCount: 0, layerCount: 0 })).toBe("no_layers")
    expect(pickerListState({ ...ok, rowCount: 0 })).toBe("empty")
  })
})
