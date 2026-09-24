import { describe, expect, it } from "vitest"
import type { ReportDTO } from "@civfix/shared"
import { firstReportPhoto, latestNote, reportThumbUrl } from "../reportsListModel"

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

describe("report list helpers", () => {
  it("picks the first ready image, never a video or an unready photo", () => {
    const r = report({ media: [media("v", "ready", "video"), media("p", "validating"), media("i", "ready")] })
    expect(firstReportPhoto(r)?.id).toBe("i")
    expect(firstReportPhoto(report())).toBeUndefined()
  })

  it("thumbs a row with the first ready photo's thumbnail, its full image without one, or nothing", () => {
    const thumbed = { ...media("i", "ready"), thumbUrl: "https://x/i-thumb" } as Media
    expect(reportThumbUrl(report({ media: [media("v", "ready", "video"), thumbed] }))).toBe("https://x/i-thumb")
    expect(reportThumbUrl(report({ media: [{ ...media("i", "ready"), thumbUrl: null } as Media] }))).toBe("https://x/i")
    expect(reportThumbUrl(report({ media: [media("p", "validating")] }))).toBeNull()
  })

  it("shows the latest timeline note, trimmed, or nothing for a blank one", () => {
    expect(latestNote(report({ timeline: [{ note: "old" }, { note: "  new  " }] as unknown as ReportDTO["timeline"] }))).toBe("new")
    expect(latestNote(report({ timeline: [{ note: "   " }] as unknown as ReportDTO["timeline"] }))).toBeUndefined()
    expect(latestNote(report())).toBeUndefined()
  })
})
