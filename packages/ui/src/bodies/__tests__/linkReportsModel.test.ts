import { describe, expect, it } from "vitest"
import { MAX_LINKED_REPORTS, type ReportPinDTO, type ReportStatus } from "@civfix/shared"
import type { HostStage } from "@civfix/shared/host"
import {
  LINKED_REPORTS_COUNT_AT,
  NEARBY_MAX,
  NEARBY_PREVIEW,
  linkBlockState,
  linkSheetMode,
  linkedReportsPatch,
  linkedReportsSummary,
  linkedRowHeadline,
  nearbyReportRows,
  sameIdSet,
  toggleLinkedReportId,
} from "../linkReportsModel"

const LA = { lat: 34.0522, lng: -118.2437 }

function pin(id: string, over: Partial<ReportPinDTO> = {}): ReportPinDTO {
  return {
    id,
    category: "trash",
    status: "published",
    lat: LA.lat,
    lng: LA.lng,
    ...over,
  }
}

function north(km: number): number {
  return LA.lat + km / 111.32
}

describe("linkBlockState", () => {
  it("hides the block for a non-cleanup event whatever else is true", () => {
    for (const hasCoords of [true, false]) {
      for (const linkedCount of [0, 3]) {
        expect(linkBlockState({ isCleanup: false, hasCoords, linkedCount })).toBe("hidden")
      }
    }
  })

  it("asks for the pin first only while nothing is linked yet", () => {
    expect(linkBlockState({ isCleanup: true, hasCoords: false, linkedCount: 0 })).toBe("pin_first")
  })

  it("keeps a seeded draft's links visible after the pin is cleared", () => {
    expect(linkBlockState({ isCleanup: true, hasCoords: false, linkedCount: 1 })).toBe("ready")
  })

  it("is ready once the meeting point exists", () => {
    expect(linkBlockState({ isCleanup: true, hasCoords: true, linkedCount: 0 })).toBe("ready")
    expect(linkBlockState({ isCleanup: true, hasCoords: true, linkedCount: 9 })).toBe("ready")
  })
})

describe("toggleLinkedReportId", () => {
  it("adds an unlinked id to the end, preserving link order", () => {
    expect(toggleLinkedReportId(["a", "b"], "c")).toEqual({
      ids: ["a", "b", "c"],
      outcome: "added",
    })
  })

  it("removes a linked id", () => {
    expect(toggleLinkedReportId(["a", "b", "c"], "b")).toEqual({
      ids: ["a", "c"],
      outcome: "removed",
    })
  })

  it("refuses an add at the cap and hands back the SAME array so nothing re-renders", () => {
    const ids = ["a", "b"]
    const result = toggleLinkedReportId(ids, "c", 2)
    expect(result.outcome).toBe("at_limit")
    expect(result.ids).toBe(ids)
  })

  it("still removes at the cap", () => {
    expect(toggleLinkedReportId(["a", "b"], "a", 2)).toEqual({ ids: ["b"], outcome: "removed" })
  })

  it("defaults its cap to the contract's own maximum", () => {
    const ids = Array.from({ length: MAX_LINKED_REPORTS }, (_unused, i) => `id-${i}`)
    expect(toggleLinkedReportId(ids, "one-more").outcome).toBe("at_limit")
    expect(toggleLinkedReportId(ids.slice(0, -1), "one-more").outcome).toBe("added")
  })
})

describe("nearbyReportRows", () => {
  it("returns nothing for no pins", () => {
    expect(nearbyReportRows([], LA, [], 2)).toEqual([])
  })

  it("drops the pins that are already linked - they render in the linked group", () => {
    const rows = nearbyReportRows([pin("a"), pin("b")], LA, ["a"], 2)
    expect(rows.map((row) => row.pin.id)).toEqual(["b"])
  })

  it("trims the circumscribed box back to the circle", () => {
    const inside = pin("inside", { lat: north(1.5) })
    const outside = pin("outside", { lat: north(3) })
    const rows = nearbyReportRows([inside, outside], LA, [], 2)
    expect(rows.map((row) => row.pin.id)).toEqual(["inside"])
    expect(rows[0]?.distanceM ?? 0).toBeCloseTo(1500, -1)
  })

  it("sorts unresolved first, then by distance, then by id", () => {
    const rows = nearbyReportRows(
      [
        pin("far", { lat: north(1) }),
        pin("resolved-near", { status: "resolved" as ReportStatus, lat: north(0.1) }),
        pin("near-b", { lat: north(0.5) }),
        pin("near-a", { lat: north(0.5) }),
      ],
      LA,
      [],
      2,
    )
    expect(rows.map((row) => row.pin.id)).toEqual(["near-a", "near-b", "far", "resolved-near"])
  })

  it("caps nothing itself - the component slices the preview", () => {
    const pins = Array.from({ length: 40 }, (_unused, i) => pin(`p${i}`, { lat: north(i / 100) }))
    expect(nearbyReportRows(pins, LA, [], 2)).toHaveLength(40)
    expect(NEARBY_PREVIEW).toBe(3)
    expect(NEARBY_MAX).toBe(30)
  })
})

describe("linkSheetMode", () => {
  const STAGES: readonly HostStage[] = [
    "upcoming",
    "soon",
    "underway",
    "wrapping_up",
    "past",
    "cancelled",
  ]

  it("hides everything without manage_event or off a cleanup", () => {
    for (const stage of STAGES) {
      expect(linkSheetMode({ stage, canManage: false, isCleanup: true, linkedCount: 4 })).toBe(
        "hidden",
      )
      expect(linkSheetMode({ stage, canManage: true, isCleanup: false, linkedCount: 4 })).toBe(
        "hidden",
      )
    }
  })

  it("lets a host manage links right through the run of the event", () => {
    for (const stage of ["upcoming", "soon", "underway"] as const) {
      expect(linkSheetMode({ stage, canManage: true, isCleanup: true, linkedCount: 0 })).toBe(
        "manage",
      )
    }
  })

  it("freezes the list once the event is over, and hides it when there is nothing to show", () => {
    for (const stage of ["wrapping_up", "past", "cancelled"] as const) {
      expect(linkSheetMode({ stage, canManage: true, isCleanup: true, linkedCount: 2 })).toBe(
        "readonly",
      )
      expect(linkSheetMode({ stage, canManage: true, isCleanup: true, linkedCount: 0 })).toBe(
        "hidden",
      )
    }
  })
})

describe("sameIdSet", () => {
  it("ignores order", () => {
    expect(sameIdSet(["a", "b"], ["b", "a"])).toBe(true)
  })

  it("notices an add, a removal and a swap", () => {
    expect(sameIdSet(["a"], ["a", "b"])).toBe(false)
    expect(sameIdSet(["a", "b"], ["a"])).toBe(false)
    expect(sameIdSet(["a", "b"], ["a", "c"])).toBe(false)
  })

  it("treats two empty selections as unchanged", () => {
    expect(sameIdSet([], [])).toBe(true)
  })
})

describe("linkedRowHeadline", () => {
  it("prints the reference when the card carries one", () => {
    expect(linkedRowHeadline({ referenceCode: "DU-42-000118" })).toBe("reference")
  })

  it("falls back to the human title rather than a raw uuid", () => {
    expect(linkedRowHeadline({})).toBe("title")
    expect(linkedRowHeadline({ referenceCode: null })).toBe("title")
    expect(linkedRowHeadline({ referenceCode: "  " })).toBe("title")
  })
})

describe("linkedReportsPatch", () => {
  it("sends the linked ids and nothing else, so no other field on the event moves", () => {
    expect(linkedReportsPatch(["a", "b"])).toEqual({ linkedReportIds: ["a", "b"] })
    expect(Object.keys(linkedReportsPatch([]))).toEqual(["linkedReportIds"])
  })

  it("copies the ids so a later edit of the selection cannot mutate a sent patch", () => {
    const ids = ["a"]
    const patch = linkedReportsPatch(ids)
    ids.push("b")
    expect(patch.linkedReportIds).toEqual(["a"])
  })

  it("clears every link when the host unlinks the last report", () => {
    expect(linkedReportsPatch([]).linkedReportIds).toEqual([])
  })
})

describe("linkedReportsSummary", () => {
  it("says nothing at all for an event that is not a cleanup", () => {
    expect(linkedReportsSummary({ eventKind: "other_volunteer", linkedCount: 4 })).toBeNull()
  })

  it("counts the links on a cleanup that has some", () => {
    expect(linkedReportsSummary({ eventKind: "cleanup", linkedCount: 4 })).toEqual({
      labelKey: "wizard.summary.reports",
      valueKey: "wizard.summary.reports_count",
      count: 4,
    })
  })

  it("falls back to the none copy on a cleanup with no links", () => {
    expect(linkedReportsSummary({ eventKind: "cleanup", linkedCount: 0 })?.valueKey).toBe(
      "wizard.summary.noReports",
    )
  })
})

describe("LINKED_REPORTS_COUNT_AT", () => {
  it("keeps the plain heading up to the visible tail and counts past it", () => {
    expect(LINKED_REPORTS_COUNT_AT).toBe(3)
    expect(LINKED_REPORTS_COUNT_AT).toBeLessThanOrEqual(NEARBY_PREVIEW)
  })
})
