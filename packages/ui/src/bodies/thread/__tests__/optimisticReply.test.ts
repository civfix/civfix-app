import { describe, expect, it } from "vitest"
import type { LinkedEventRef, PersonDTO, ReportDTO } from "@civfix/shared"
import type { PostComposerMedia } from "../../postComposerStore"
import { buildOptimisticReply, REPORT_TITLE_FALLBACK, type OptimisticReplyInput } from "../optimisticReply"
import { isOptimisticPostId } from "../threadModel"

const NOW = new Date("2026-09-24T10:00:00.000Z")
const author = { id: "me", name: "Me" } as unknown as PersonDTO

function input(overrides: Partial<OptimisticReplyInput> = {}): OptimisticReplyInput {
  return {
    author,
    body: "hello",
    readyMedia: [],
    mentions: [],
    attachedEvent: null,
    attachedReport: null,
    attachedReportId: null,
    focalPost: { id: "focal", threadRootId: null },
    now: NOW,
    ...overrides,
  }
}

const report = (overrides: Partial<ReportDTO> = {}): ReportDTO =>
  ({
    id: "r1",
    category: "trash",
    title: "  Overflowing bin  ",
    status: "open",
    lat: 1,
    lng: 2,
    addr: null,
    ...overrides,
  }) as unknown as ReportDTO

describe("buildOptimisticReply", () => {
  it("is a fresh, zero-count reply to the focal post, stamped with the send time", () => {
    const post = buildOptimisticReply(input())
    expect(isOptimisticPostId(post.id)).toBe(true)
    expect(post.id).toBe(`optimistic-${NOW.getTime()}`)
    expect(post).toMatchObject({
      author,
      kind: "reply",
      body: "hello",
      createdAt: NOW.toISOString(),
      editedAt: null,
      counts: { likes: 0, reposts: 0, replies: 0, saves: 0 },
      viewer: { liked: false, reposted: false, saved: false },
      event: null,
      report: null,
      repostOf: null,
      replyToId: "focal",
      threadRootId: "focal",
    })
  })

  it("roots a reply-to-a-reply under the focal post's own thread root", () => {
    expect(buildOptimisticReply(input({ focalPost: { id: "reply-1", threadRootId: "root" } })).threadRootId).toBe("root")
  })

  it("carries only finalized media, as ready server media", () => {
    const readyMedia: PostComposerMedia[] = [
      { uri: "file://a", kind: "image", posterUri: null, uploadId: "u1", status: "ready" },
      { uri: "file://b", kind: "video", posterUri: "file://b.jpg", uploadId: null, status: "ready" },
    ]
    expect(buildOptimisticReply(input({ readyMedia })).media).toEqual([
      { id: "u1", kind: "image", url: "file://a", thumbUrl: null, status: "ready" },
    ])
  })

  it("links the attached event at the send time", () => {
    const event = { id: "e1", title: "Park cleanup" } as unknown as LinkedEventRef
    expect(buildOptimisticReply(input({ attachedEvent: event })).event).toEqual({
      ...event,
      linkedAt: NOW.toISOString(),
    })
  })

  it("draws the attached report from its row, trimming the title and falling back like the server", () => {
    const linked = buildOptimisticReply(input({ attachedReport: report(), attachedReportId: "r1" })).report
    expect(linked).toEqual({
      id: "r1",
      category: "trash",
      title: "Overflowing bin",
      status: "open",
      lat: 1,
      lng: 2,
      addr: null,
      thumbUrl: null,
      linkedAt: NOW.toISOString(),
    })
    const untitled = buildOptimisticReply(
      input({ attachedReport: report({ title: "   " }), attachedReportId: "r1" }),
    ).report
    expect(untitled?.title).toBe(REPORT_TITLE_FALLBACK)
    expect(REPORT_TITLE_FALLBACK).toBe("Report")
  })

  it("never links a report row that belongs to a previous pick", () => {
    expect(buildOptimisticReply(input({ attachedReport: report(), attachedReportId: "r2" })).report).toBeNull()
  })
})
