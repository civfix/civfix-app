import { describe, expect, it } from "vitest"
import type { ReportDTO } from "@civfix/shared"
import { partitionGalleryMedia } from "../reportDetailModel"
import { firstReportPhoto, latestNote } from "../reportsListModel"

type Media = ReportDTO["media"][number]
const media = (id: string, status: Media["status"], kind: Media["kind"] = "image"): Media =>
  ({ id, status, kind, url: `https://x/${id}` }) as Media

function report(over: Partial<ReportDTO> = {}): ReportDTO {
  return {
    id: "r1",
    mine: false,
    gov: false,
    createdAt: "2026-01-01T00:00:00Z",
    publishedAt: null,
    timeline: [],
    linkedEvents: [],
    media: [],
    mediaPending: 0,
    ...over,
  } as unknown as ReportDTO
}

describe("partitionGalleryMedia", () => {
  it("splits ready, processing and failed media and counts a tile for every unlisted pending upload", () => {
    const tiles = partitionGalleryMedia(
      [media("a", "ready"), media("b", "validating"), media("c", "rejected"), media("d", "held"), media("e", "ready")],
      2,
    )
    expect(tiles.ready.map((m) => m.id)).toEqual(["a", "e"])
    expect(tiles.ownerPending.map((m) => m.id)).toEqual(["b"])
    expect(tiles.ownerFailed.map((m) => m.id)).toEqual(["c", "d"])
    expect(tiles.tileCount).toBe(7)
  })
})

describe("report list helpers", () => {
  it("picks the first ready image, never a video or an unready photo", () => {
    const r = report({ media: [media("v", "ready", "video"), media("p", "validating"), media("i", "ready")] })
    expect(firstReportPhoto(r)?.id).toBe("i")
    expect(firstReportPhoto(report())).toBeUndefined()
  })

  it("shows the latest timeline note, trimmed, or nothing for a blank one", () => {
    expect(latestNote(report({ timeline: [{ note: "old" }, { note: "  new  " }] as unknown as ReportDTO["timeline"] }))).toBe("new")
    expect(latestNote(report({ timeline: [{ note: "   " }] as unknown as ReportDTO["timeline"] }))).toBeUndefined()
    expect(latestNote(report())).toBeUndefined()
  })
})
