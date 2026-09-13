import { describe, expect, it } from "vitest"
import type { ReportStatus } from "@civfix/shared"
import {
  attachableEvents,
  attachableReports,
  isAttachableEvent,
  isAttachableReport,
} from "../composerAttachable"

describe("isAttachableReport", () => {
  it("accepts the still-live report statuses", () => {
    for (const status of ["submitted", "published", "acknowledged", "in_progress"] as ReportStatus[]) {
      expect(isAttachableReport({ status })).toBe(true)
    }
  })

  it("rejects the finished and withheld report statuses", () => {
    for (const status of ["resolved", "rejected", "held"] as ReportStatus[]) {
      expect(isAttachableReport({ status })).toBe(false)
    }
  })
})

const NOW = Date.parse("2026-09-13T18:00:00.000Z")
const HOUR = 3_600_000

const event = (over: { status?: "upcoming" | "active" | "done" | "cancelled"; startsAt?: number; endsAt?: number } = {}) => ({
  status: over.status ?? "upcoming",
  scheduledAt: new Date(over.startsAt ?? NOW + 24 * HOUR).toISOString(),
  endsAt: new Date(over.endsAt ?? (over.startsAt ?? NOW + 24 * HOUR) + 4 * HOUR).toISOString(),
})

describe("isAttachableEvent", () => {
  it("accepts an event that has not ended, whatever its stored status says", () => {
    expect(isAttachableEvent(event(), NOW)).toBe(true)
    expect(isAttachableEvent(event({ startsAt: NOW - HOUR }), NOW)).toBe(true)
    expect(isAttachableEvent(event({ status: "done", startsAt: NOW - HOUR }), NOW)).toBe(true)
  })

  it("rejects an event whose end instant has passed, and any cancelled one", () => {
    expect(isAttachableEvent(event({ startsAt: NOW - 5 * HOUR }), NOW)).toBe(false)
    expect(isAttachableEvent(event({ status: "cancelled" }), NOW)).toBe(false)
  })
})

describe("the list filters", () => {
  it("keeps only attachable rows and preserves order", () => {
    const reports = [
      { id: "a", status: "published" as ReportStatus },
      { id: "b", status: "resolved" as ReportStatus },
      { id: "c", status: "in_progress" as ReportStatus },
    ]
    expect(attachableReports(reports).map((r) => r.id)).toEqual(["a", "c"])

    const events = [
      { id: "x", ...event({ status: "cancelled" }) },
      { id: "y", ...event() },
      { id: "z", ...event({ startsAt: NOW - 5 * HOUR }) },
    ]
    expect(attachableEvents(events, NOW).map((e) => e.id)).toEqual(["y"])
  })

  it("returns an empty list when nothing is selectable", () => {
    expect(attachableReports([{ status: "resolved" as ReportStatus }])).toEqual([])
    expect(attachableEvents([event({ startsAt: NOW - 5 * HOUR })], NOW)).toEqual([])
  })
})
