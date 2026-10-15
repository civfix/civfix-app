import { describe, it, expect } from "vitest"
import {
  OPEN_REPORT_STATUSES,
  PUBLIC_REPORT_STATUSES,
  PressingReportsRequestSchema,
  PressingReportsResponseSchema,
  ReportConfirmRequestSchema,
  ReportConfirmResponseSchema,
  ReportDTOSchema,
  ReportPinDTOSchema,
} from "../src/index.js"

const UUID = "123e4567-e89b-12d3-a456-426614174000"
const BBOX = { west: -118.5, south: 34.0, east: -118.2, north: 34.2 }

function baseReport() {
  return {
    id: UUID,
    category: "trash" as const,
    status: "published" as const,
    visibility: "public" as const,
    lat: 34.05,
    lng: -118.24,
    geomSource: "device" as const,
    createdAt: "2026-06-01T12:00:00.000Z",
    mine: false,
    gov: false,
    following: false,
    media: [],
    timeline: [],
  }
}

function basePin() {
  return {
    id: UUID,
    category: "trash" as const,
    lat: 34.05,
    lng: -118.24,
    status: "published" as const,
  }
}

describe("ReportDTO confirmations", () => {
  it("parses an older response without the new fields as 0 and false", () => {
    const r = ReportDTOSchema.parse(baseReport())
    expect(r.confirmCount).toBe(0)
    expect(r.confirmedByMe).toBe(false)
  })

  it("carries the count and the caller's own confirmation", () => {
    const r = ReportDTOSchema.parse({ ...baseReport(), confirmCount: 3, confirmedByMe: true })
    expect(r.confirmCount).toBe(3)
    expect(r.confirmedByMe).toBe(true)
  })

  it("rejects a negative or fractional count", () => {
    expect(ReportDTOSchema.safeParse({ ...baseReport(), confirmCount: -1 }).success).toBe(false)
    expect(ReportDTOSchema.safeParse({ ...baseReport(), confirmCount: 1.5 }).success).toBe(false)
  })
})

describe("ReportPinDTO confirmCount", () => {
  it("parses an older pin without it as 0", () => {
    expect(ReportPinDTOSchema.parse(basePin()).confirmCount).toBe(0)
  })

  it("carries the count", () => {
    expect(ReportPinDTOSchema.parse({ ...basePin(), confirmCount: 7 }).confirmCount).toBe(7)
  })

  it("rejects a negative or fractional count", () => {
    expect(ReportPinDTOSchema.safeParse({ ...basePin(), confirmCount: -1 }).success).toBe(false)
    expect(ReportPinDTOSchema.safeParse({ ...basePin(), confirmCount: 0.5 }).success).toBe(false)
  })
})

describe("confirmReport / unconfirmReport schemas", () => {
  it("takes only a UUID id", () => {
    expect(ReportConfirmRequestSchema.safeParse({ id: UUID }).success).toBe(true)
    expect(ReportConfirmRequestSchema.safeParse({ id: "R-1234" }).success).toBe(false)
    expect(ReportConfirmRequestSchema.safeParse({ id: UUID, extra: 1 }).success).toBe(false)
  })

  it("answers the count and whether the caller now confirms it", () => {
    expect(ReportConfirmResponseSchema.parse({ confirmCount: 4, confirmedByMe: true })).toEqual({
      confirmCount: 4,
      confirmedByMe: true,
    })
    expect(ReportConfirmResponseSchema.safeParse({ confirmCount: -1, confirmedByMe: false }).success).toBe(
      false,
    )
  })
})

describe("pressingReports schemas", () => {
  it("takes a bbox under the mapReports bbox rules and nothing else", () => {
    expect(PressingReportsRequestSchema.safeParse({ bbox: BBOX }).success).toBe(true)
    expect(PressingReportsRequestSchema.safeParse({ bbox: { ...BBOX, north: 91 } }).success).toBe(false)
    expect(PressingReportsRequestSchema.safeParse({ bbox: BBOX, zoom: 12 }).success).toBe(false)
    expect(PressingReportsRequestSchema.safeParse({ bbox: BBOX, categories: ["trash"] }).success).toBe(
      false,
    )
  })

  it("accepts up to 20 items and fills each pin's count", () => {
    const res = PressingReportsResponseSchema.parse({ items: Array.from({ length: 20 }, basePin) })
    expect(res.items).toHaveLength(20)
    expect(res.items[0]!.confirmCount).toBe(0)
  })

  it("rejects 21 items", () => {
    expect(PressingReportsResponseSchema.safeParse({ items: Array.from({ length: 21 }, basePin) }).success).toBe(
      false,
    )
  })
})

describe("report status lists", () => {
  it("lists the statuses a non-owner can see", () => {
    expect(PUBLIC_REPORT_STATUSES).toEqual(["published", "acknowledged", "in_progress", "resolved"])
  })

  it("lists the open statuses that take a Me too", () => {
    expect(OPEN_REPORT_STATUSES).toEqual(["published", "acknowledged", "in_progress"])
  })
})
