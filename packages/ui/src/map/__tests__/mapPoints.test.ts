import { describe, it, expect } from "vitest"
import type { CleanupDTO, ReportPinDTO } from "@civfix/shared"
import { mapPointsFor } from "../mapPoints"

function pin(id: string, lat = 34.05, lng = -118.25): ReportPinDTO {
  return { id, category: "trash", lat, lng, status: "published" }
}

function event(id: string, linkedReports: CleanupDTO["linkedReports"] = []): CleanupDTO {
  return {
    id,
    lat: 34.06,
    lng: -118.26,
    eventKind: "cleanup",
    linkedReports,
  } as unknown as CleanupDTO
}

describe("mapPointsFor", () => {
  it("maps reports and events into one point set the clusterer can index", () => {
    const points = mapPointsFor({
      reports: [pin("r1"), pin("r2", 34.1)],
      cleanups: [event("e1")],
      aggregates: [],
    })
    expect(points.map((p) => `${p.kind}:${p.id}`).sort()).toEqual([
      "event:e1",
      "report:r1",
      "report:r2",
    ])
  })

  it("turns a linked event into one blend point and drops the reports it absorbed", () => {
    const linked = [
      { id: "r1", category: "trash", lat: 34.05, lng: -118.25, status: "published", title: "t" },
    ] as unknown as CleanupDTO["linkedReports"]
    const points = mapPointsFor({
      reports: [pin("r1"), pin("r2", 34.1)],
      cleanups: [event("e1", linked)],
      aggregates: [],
    })
    expect(points.map((p) => `${p.kind}:${p.id}`).sort()).toEqual(["blend:e1", "report:r2"])
    const blend = points.find((p) => p.kind === "blend")
    expect(blend?.kind === "blend" && blend.reports.map((r) => r.id)).toEqual(["r1"])
  })

  it("maps server aggregates into weighted points keyed by their position", () => {
    const points = mapPointsFor({
      reports: [],
      cleanups: [],
      aggregates: [{ lat: 34.05, lng: -118.25, count: 9 }],
    })
    expect(points).toEqual([
      { kind: "aggregate", id: "-118.25000,34.05000", lat: 34.05, lng: -118.25, count: 9 },
    ])
  })

  it("ignores server aggregates whenever individual points are available", () => {
    const points = mapPointsFor({
      reports: [pin("r1")],
      cleanups: [],
      aggregates: [{ lat: 34.05, lng: -118.25, count: 9 }],
    })
    expect(points.map((p) => p.kind)).toEqual(["report"])
  })

  it("collapses aggregates that round to the same position into one point", () => {
    const points = mapPointsFor({
      reports: [],
      cleanups: [],
      aggregates: [
        { lat: 34.05, lng: -118.25, count: 9 },
        { lat: 34.050001, lng: -118.250001, count: 4 },
      ],
    })
    expect(points).toHaveLength(1)
  })

  it("drops empty aggregates and non-finite coordinates", () => {
    const points = mapPointsFor({
      reports: [pin("bad", Number.NaN)],
      cleanups: [],
      aggregates: [
        { lat: 34.05, lng: -118.25, count: 0 },
        { lat: Number.POSITIVE_INFINITY, lng: -118.25, count: 3 },
      ],
    })
    expect(points).toEqual([])
  })

  it("stays empty when the map has nothing to draw", () => {
    expect(mapPointsFor({ reports: [], cleanups: [], aggregates: [] })).toEqual([])
  })
})
