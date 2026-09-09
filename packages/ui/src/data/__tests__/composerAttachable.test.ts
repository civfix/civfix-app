import { describe, expect, it } from "vitest"
import type { CleanupStatus, ReportStatus } from "@civfix/shared"
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

describe("isAttachableEvent", () => {
  it("accepts upcoming and in-progress events", () => {
    for (const status of ["upcoming", "active"] as CleanupStatus[]) {
      expect(isAttachableEvent({ status })).toBe(true)
    }
  })

  it("rejects finished and cancelled events", () => {
    for (const status of ["done", "cancelled"] as CleanupStatus[]) {
      expect(isAttachableEvent({ status })).toBe(false)
    }
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
      { id: "x", status: "cancelled" as CleanupStatus },
      { id: "y", status: "active" as CleanupStatus },
      { id: "z", status: "done" as CleanupStatus },
    ]
    expect(attachableEvents(events).map((e) => e.id)).toEqual(["y"])
  })

  it("returns an empty list when nothing is selectable", () => {
    expect(attachableReports([{ status: "resolved" as ReportStatus }])).toEqual([])
    expect(attachableEvents([{ status: "done" as CleanupStatus }])).toEqual([])
  })
})
