import { describe, it, expect } from "vitest"
import type { CleanupDTO, LinkedReportRef, ReportPinDTO } from "@civfix/shared"
import { computeMapBlends } from "../blend"

function pin(id: string, category: ReportPinDTO["category"] = "trash"): ReportPinDTO {
  return { id, category, lat: 34.05, lng: -118.25, status: "published" }
}

function linkedRef(id: string): LinkedReportRef {
  return {
    id,
    category: "trash",
    title: "A report",
    status: "published",
    lat: 34.05,
    lng: -118.25,
    linkedAt: "2026-06-01T00:00:00.000Z",
  }
}

function cleanup(
  id: string,
  over: Partial<CleanupDTO> = {},
): CleanupDTO {
  return {
    id,
    title: `Event ${id}`,
    type: "site",
    eventKind: "cleanup",
    lat: 34.05,
    lng: -118.25,
    scheduledAt: "2026-06-10T00:00:00.000Z",
    status: "upcoming",
    organizer: { id: "u1", name: "Org", followers: 0, following: 0, isFollowing: false, avatar: null },
    going: 0,
    joined: false,
    bring: [],
    address: null,
    linkedReports: [],
    slots: [],
    visibility: "public",
    galleryUrls: [],
    ticketTypes: [],
    myCapabilities: [],
    ...over,
  }
}

describe("computeMapBlends", () => {
  it("blends an event that has linked reports, absorbing those reports from the standalone set", () => {
    const reports = [pin("r1"), pin("r2"), pin("r3")]
    const events = [cleanup("e1", { linkedReports: [linkedRef("r1"), linkedRef("r2")] })]
    const { blends, standaloneReports, standaloneCleanups } = computeMapBlends(reports, events)

    expect(blends).toHaveLength(1)
    expect(blends[0]!.event.id).toBe("e1")
    expect(blends[0]!.reports.map((r) => r.id)).toEqual(["r1", "r2"])
    expect(standaloneReports.map((r) => r.id)).toEqual(["r3"])
    expect(standaloneCleanups).toHaveLength(0)
  })

  it("keeps an event with NO linked reports as a standalone cleanup (no blend)", () => {
    const reports = [pin("r1")]
    const events = [cleanup("e1")]
    const { blends, standaloneReports, standaloneCleanups } = computeMapBlends(reports, events)
    expect(blends).toHaveLength(0)
    expect(standaloneCleanups.map((c) => c.id)).toEqual(["e1"])
    expect(standaloneReports).toBe(reports)
    expect(standaloneCleanups).toBe(events)
  })

  it("never blends a non-cleanup event even if it somehow carries links", () => {
    const events = [
      cleanup("e1", { eventKind: "other_volunteer", linkedReports: [linkedRef("r1")] }),
    ]
    const { blends, standaloneCleanups } = computeMapBlends([pin("r1")], events)
    expect(blends).toHaveLength(0)
    expect(standaloneCleanups.map((c) => c.id)).toEqual(["e1"])
  })

  it("blends multiple events and absorbs every linked report across them", () => {
    const reports = [pin("r1"), pin("r2"), pin("r3"), pin("r4")]
    const events = [
      cleanup("e1", { linkedReports: [linkedRef("r1")] }),
      cleanup("e2", { linkedReports: [linkedRef("r2"), linkedRef("r3")] }),
      cleanup("e3"),
    ]
    const { blends, standaloneReports, standaloneCleanups } = computeMapBlends(reports, events)
    expect(blends.map((b) => b.event.id)).toEqual(["e1", "e2"])
    expect(standaloneReports.map((r) => r.id)).toEqual(["r4"])
    expect(standaloneCleanups.map((c) => c.id)).toEqual(["e3"])
  })

  it("carries a linked report's pin fields through to the blend (category/coords/status/title)", () => {
    const events = [
      cleanup("e1", {
        linkedReports: [
          { ...linkedRef("r1"), category: "graffiti", status: "in_progress", title: "Tagged wall" },
        ],
      }),
    ]
    const { blends } = computeMapBlends([], events)
    const p = blends[0]!.reports[0]!
    expect(p).toMatchObject({ id: "r1", category: "graffiti", status: "in_progress", title: "Tagged wall" })
  })
})
