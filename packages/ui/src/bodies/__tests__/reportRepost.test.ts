import { beforeEach, describe, expect, it } from "vitest"
import { ReportStatusSchema, type LinkedEventRef, type ReportDTO, type ReportStatus } from "@civfix/contract"
import { canRepostReport } from "../reportDetail/useReportRepost"
import { usePostComposerStore } from "../postComposerStore"
import { buildComposerReportRef, shouldClearStaleAttachedReport } from "../postComposerModel"

const store = () => usePostComposerStore.getState()
const draft = () => usePostComposerStore.getState().draft

function report(over: Partial<ReportDTO>): ReportDTO {
  return {
    id: "report-a",
    category: "trash",
    status: "published",
    visibility: "public",
    title: "Sofa on the curb",
    description: null,
    lat: 34.05,
    lng: -118.24,
    addr: "1st St",
    media: [],
    ...over,
  } as unknown as ReportDTO
}

const reportA = report({ id: "report-a", title: "Sofa on the curb" })
const reportB = report({ id: "report-b", title: "Broken streetlight", category: "streetlight" as ReportDTO["category"] })

const eventE: LinkedEventRef = {
  id: "event-e",
  title: "Garden cleanup",
  eventKind: "cleanup",
  status: "upcoming",
  scheduledAt: "2026-07-25T17:00:00.000Z",
  lat: 1,
  lng: 2,
  going: 3,
  organizer: { id: "o1", name: "Maya", followers: 0, following: 0, isFollowing: false },
  linkedAt: "2026-07-21T18:30:00.000Z",
}

beforeEach(() => {
  store().setOrganizationId(null)
  store().reset()
})

describe("canRepostReport", () => {
  it.each<ReportStatus>(["published", "acknowledged", "in_progress", "resolved"])(
    "T1: a public %s report can be reposted",
    (status) => {
      expect(canRepostReport({ visibility: "public", status })).toBe(true)
    },
  )

  it.each<ReportStatus>(["submitted", "held", "rejected"])("T2: a public %s report cannot be reposted", (status) => {
    expect(canRepostReport({ visibility: "public", status })).toBe(false)
  })

  it.each<ReportStatus>(ReportStatusSchema.options)("T3: a hidden %s report cannot be reposted", (status) => {
    expect(canRepostReport({ visibility: "hidden", status })).toBe(false)
  })

  it("T3: covers all 7 report statuses", () => {
    expect(ReportStatusSchema.options).toHaveLength(7)
  })
})

describe("reposting a report into the composer draft", () => {
  it("T4: keeps the unsent body and attaches the report", () => {
    store().setBody("look at this")

    store().setAttachedReport(buildComposerReportRef(reportB))

    expect(draft().body).toBe("look at this")
    expect(draft().attachedReportId).toBe(reportB.id)
    expect(draft().attachedReport?.id).toBe(reportB.id)
    expect(draft().attachedReport?.title).toBe(reportB.title)
  })

  it("T5: replaces an attached report and keeps the attached event and body", () => {
    store().setBody("x")
    store().setAttachedReport(buildComposerReportRef(reportA))
    store().setAttachedEvent(eventE)

    store().setAttachedReport(buildComposerReportRef(reportB))

    expect(draft().attachedReportId).toBe(reportB.id)
    expect(draft().attachedEventId).toBe(eventE.id)
    expect(draft().body).toBe("x")
  })
})

describe("shouldClearStaleAttachedReport", () => {
  it("T6: keeps someone else's reposted report that has a snapshot", () => {
    expect(
      shouldClearStaleAttachedReport({
        attachedReportId: reportB.id,
        resolved: false,
        loaded: true,
        hasNextPage: false,
        hasSnapshot: true,
      }),
    ).toBe(false)
  })
})
