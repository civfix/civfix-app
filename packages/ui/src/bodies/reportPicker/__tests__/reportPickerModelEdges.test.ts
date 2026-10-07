import { describe, expect, it } from "vitest"
import type { BBox, LinkedReportRef, ReportPinDTO } from "@civfix/shared"
import type { LinkedReportCardEntry } from "../../linkedReportCards"
import { toggleLinkedReportId } from "../../linkReportsModel"
import {
  PICKER_MAX_FETCH_SPAN_DEG,
  QUERY_RANK,
  optimisticLinkedRefs,
  pickerFetchRegion,
  pickerListItems,
  pickerListState,
  pickerRows,
  pickerSections,
  pinStateKey,
  queryRank,
  refFromCard,
  reportLookupKey,
  reportShortCode,
  rowIndexOf,
  rowOrdinalOf,
  selectionDiff,
} from "../reportPickerModel"

const LA = { lat: 34.0522, lng: -118.2437 }

function pin(id: string, over: Partial<ReportPinDTO> = {}): ReportPinDTO {
  return { id, category: "trash", status: "published", lat: LA.lat, lng: LA.lng, ...over }
}

describe("pickerFetchRegion edges", () => {
  it("accepts a viewport exactly at the span cap and refuses one just past it", () => {
    const atCap: BBox = { west: 0, east: PICKER_MAX_FETCH_SPAN_DEG, south: 0, north: 0.01 }
    expect(pickerFetchRegion(atCap)).not.toBeNull()
    expect(pickerFetchRegion({ ...atCap, east: PICKER_MAX_FETCH_SPAN_DEG + 1e-9 })).toBeNull()
  })

  it("refuses a viewport whose height alone exceeds the cap", () => {
    expect(pickerFetchRegion({ west: 0, east: 0.01, south: 0, north: PICKER_MAX_FETCH_SPAN_DEG + 0.01 })).toBeNull()
  })

  it("refuses an inverted or non-finite viewport", () => {
    expect(pickerFetchRegion({ west: 1, east: 0, south: 0, north: 1 })).toBeNull()
    expect(pickerFetchRegion({ west: 0, east: 1, south: 1, north: 0 })).toBeNull()
    expect(pickerFetchRegion({ west: Number.NaN, east: 0.1, south: 0, north: 0.1 })).toBeNull()
  })

  it("clamps the padded region to the valid latitude and longitude range", () => {
    expect(pickerFetchRegion({ west: 179.9, east: 179.99, south: 89.9, north: 89.99 })).toEqual({
      west: 179.855,
      east: 180,
      south: 89.855,
      north: 90,
    })
    expect(pickerFetchRegion({ west: -179.99, east: -179.9, south: -89.99, north: -89.9 })).toEqual({
      west: -180,
      east: -179.855,
      south: -90,
      north: -89.855,
    })
  })
})

describe("queryRank edges", () => {
  it("treats a whitespace-only query like an empty one", () => {
    expect(queryRank(pin("a"), "   ")).toBe(QUERY_RANK.otherFields)
  })

  it("ranks an exact reference code as an exact id hit, case-insensitively", () => {
    expect(queryRank(pin("a", { referenceCode: "DU-42-000123" }), "du-42-000123")).toBe(QUERY_RANK.exactId)
    expect(queryRank(pin("a", { referenceCode: "DU-42-000123" }), "DU-42")).toBe(QUERY_RANK.idPrefix)
  })

  it("never matches an empty reference code as a prefix", () => {
    expect(queryRank(pin("zzz", { referenceCode: "  " }), "q")).toBeNull()
  })

  it("scores a multi-word query that starts words in any order as a title-word hit", () => {
    expect(queryRank(pin("a", { title: "Broken streetlight on Main" }), "main street")).toBe(QUERY_RANK.titleWord)
  })

  it("falls back to other fields when one token hits the title and the other the address", () => {
    expect(queryRank(pin("a", { title: "Couch", addr: "5th Street" }), "couch 5th")).toBe(QUERY_RANK.otherFields)
  })

  it("trims the query before comparing against the id", () => {
    expect(queryRank(pin("abc"), "  ABC  ")).toBe(QUERY_RANK.exactId)
  })
})

describe("reportLookupKey and reportShortCode edges", () => {
  it("rejects a uuid with surrounding noise and a malformed reference", () => {
    expect(reportLookupKey("x0f9a1e2c-1111-4222-8333-444455556666")).toBeNull()
    expect(reportLookupKey("DU-1-12345")).toBeNull()
    expect(reportLookupKey("D-1-123456")).toBeNull()
  })

  it("falls back to the uuid prefix when the reference is blank", () => {
    expect(reportShortCode({ id: "0f9a1e2c-1111", referenceCode: "   " })).toBe("#0f9a1e2c")
    expect(reportShortCode({ id: "0f9a1e2c-1111", referenceCode: null })).toBe("#0f9a1e2c")
    expect(reportShortCode({ id: "0f9a1e2c-1111", referenceCode: " DU-1-000001 " })).toBe("#DU-1-000001")
  })
})

describe("refFromCard and optimisticLinkedRefs", () => {
  const card: LinkedReportCardEntry = {
    id: "c",
    category: "water",
    status: null,
    lat: 3,
    lng: 4,
    title: "  Leak  ",
    type: null,
    addr: null,
  }

  it("builds a ref with a trimmed title, a published default status and the given linkedAt", () => {
    expect(refFromCard(card, "2026-09-01T00:00:00.000Z")).toEqual({
      id: "c",
      category: "water",
      status: "published",
      title: "Leak",
      lat: 3,
      lng: 4,
      linkedAt: "2026-09-01T00:00:00.000Z",
      addr: null,
    })
  })

  it("uses an empty title when the card has none", () => {
    const { title: _omit, ...untitled } = card
    expect(refFromCard(untitled, "t").title).toBe("")
  })

  it("keeps the order of the ids, preferring an existing ref over its card", () => {
    const existing: LinkedReportRef = {
      id: "c",
      category: "water",
      status: "published",
      title: "Old",
      lat: 3,
      lng: 4,
      linkedAt: "2020-01-01T00:00:00.000Z",
    }
    const refs = optimisticLinkedRefs(["x", "c"], [existing], { c: card, x: { ...card, id: "x" } }, "now")
    expect(refs.map((ref) => [ref.id, ref.linkedAt])).toEqual([
      ["x", "now"],
      ["c", "2020-01-01T00:00:00.000Z"],
    ])
  })
})

describe("list item lookups", () => {
  const sections = pickerSections(
    pickerRows({
      pins: [pin("a"), pin("b", { lat: LA.lat + 0.001 }), pin("l", { lat: LA.lat + 0.002 })],
      center: LA,
      viewport: null,
      ids: new Set(["l"]),
      linked: new Set(["l"]),
      categories: new Set(["trash"]),
      nearbyOnly: false,
      radiusM: 500,
      query: "",
    }),
  )
  const { items } = pickerListItems(sections)

  it("lays out the linked header first, then the view header", () => {
    expect(items.map((item) => item.key)).toEqual(["h:linked", "r:l", "h:view", "r:a", "r:b"])
  })

  it("rowIndexOf counts headers, rowOrdinalOf skips them", () => {
    expect(rowIndexOf(items, "a")).toBe(3)
    expect(rowOrdinalOf(items, "a")).toBe(1)
    expect(rowIndexOf(items, "l")).toBe(1)
    expect(rowOrdinalOf(items, "l")).toBe(0)
  })

  it("returns -1 for an id that is not listed", () => {
    expect(rowIndexOf(items, "zz")).toBe(-1)
    expect(rowOrdinalOf(items, "zz")).toBe(-1)
  })

  it("shows nothing but still totals every row under a zero limit", () => {
    expect(pickerListItems(sections, 0)).toEqual({ items: [], shown: 0, total: 3 })
  })
})

describe("selection edges", () => {
  it("counts a cleared baseline as removals only", () => {
    expect(selectionDiff([], new Set(["a", "b"]))).toEqual({ selected: 0, added: 0, removed: 2, dirty: true })
  })

  it("honours a custom cap and never mutates the input", () => {
    const ids = ["a", "b"]
    expect(toggleLinkedReportId(ids, "c", 2)).toEqual({ ids: ["a", "b"], outcome: "at_limit" })
    expect(toggleLinkedReportId(ids, "a", 2)).toEqual({ ids: ["b"], outcome: "removed" })
    expect(ids).toEqual(["a", "b"])
  })

  it("keeps the raw state key outside draft mode", () => {
    expect(pinStateKey("linked", "commit")).toBe("linked")
    expect(pinStateKey("unlinking", "commit")).toBe("unlinking")
    expect(pinStateKey("selected", "draft")).toBe("selected")
    expect(pinStateKey("idle", "draft")).toBe("idle")
  })
})

describe("pickerListState edges", () => {
  const base = {
    hasRegion: true,
    pending: true,
    error: false,
    searching: false,
    pinCount: 5,
    layerCount: 7,
    rowCount: 0,
  }

  it("does not show loading over pins it already has when not searching", () => {
    expect(pickerListState(base)).toBe("empty")
  })

  it("prefers the error over loading", () => {
    expect(pickerListState({ ...base, pinCount: 0, error: true })).toBe("error")
  })
})
