/**
 * The session-scoped local thumb overlay. This is the regression net for "the user watches their photo
 * appear and then vanish": a just-created report's media asset is still `validating`, so the server's
 * linked-report projection carries no thumbUrl and neither the optimistic swap nor the immediate refetch
 * can supply one.
 */
import { beforeEach, describe, expect, it } from "vitest"
import {
  clearLocalReportThumbs,
  localReportThumb,
  rememberLocalReportThumb,
} from "../localReportThumbs"

beforeEach(() => clearLocalReportThumbs())

describe("localReportThumbs", () => {
  it("round-trips a remembered uri", () => {
    rememberLocalReportThumb("report-1", "file:///tmp/photo.jpg")
    expect(localReportThumb("report-1")).toBe("file:///tmp/photo.jpg")
  })

  it("returns null for an id this session never captured", () => {
    expect(localReportThumb("unknown")).toBeNull()
  })

  it("evicts the OLDEST entry past the 20-item cap", () => {
    for (let i = 0; i < 21; i++) rememberLocalReportThumb(`report-${i}`, `file:///${i}.jpg`)
    expect(localReportThumb("report-0")).toBeNull()
    expect(localReportThumb("report-1")).toBe("file:///1.jpg")
    expect(localReportThumb("report-20")).toBe("file:///20.jpg")
  })

  it("refreshes recency when the same id is remembered again", () => {
    for (let i = 0; i < 20; i++) rememberLocalReportThumb(`report-${i}`, `file:///${i}.jpg`)
    // report-0 is now the oldest; touching it moves it to the newest slot...
    rememberLocalReportThumb("report-0", "file:///0-again.jpg")
    // ...so the NEXT insertion evicts report-1 instead.
    rememberLocalReportThumb("report-20", "file:///20.jpg")
    expect(localReportThumb("report-0")).toBe("file:///0-again.jpg")
    expect(localReportThumb("report-1")).toBeNull()
  })
})
