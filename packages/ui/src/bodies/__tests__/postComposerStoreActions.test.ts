import { beforeEach, describe, expect, it } from "vitest"
import type { LinkedEventRef, LinkedReportRef, UserMentionDTO } from "@civfix/shared"
import {
  selectPostComposerDraft,
  selectPostComposerHasPendingMedia,
  usePostComposerStore,
  type PostComposerMedia,
} from "../postComposerStore"

const store = () => usePostComposerStore.getState()
const draft = () => usePostComposerStore.getState().draft

function media(uri: string, over: Partial<PostComposerMedia> = {}): PostComposerMedia {
  return { uri, kind: "image", posterUri: null, uploadId: null, status: "pending", ...over }
}

const event: LinkedEventRef = {
  id: "event-1",
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

const report: LinkedReportRef = {
  id: "report-1",
  category: "trash",
  status: "published",
  title: "Sofa",
  lat: 1,
  lng: 2,
  linkedAt: "2026-07-21T18:30:00.000Z",
}

beforeEach(() => {
  store().setOrganizationId(null)
  store().reset()
})

describe("postComposerStore serialization", () => {
  it("keeps only id, handle and display name of each mention", () => {
    const rich = { id: "m", handle: "maya", displayName: "Maya", avatarUrl: "x", extra: 1 } as unknown as UserMentionDTO
    store().setMentionedUsers([rich])
    expect(draft().mentionedUsers).toEqual([{ id: "m", handle: "maya", displayName: "Maya" }])
  })

  it("copies the attached event and its organizer instead of holding the caller's objects", () => {
    store().setAttachedEvent(event)
    expect(draft().attachedEvent).toEqual(event)
    expect(draft().attachedEvent).not.toBe(event)
    expect(draft().attachedEvent?.organizer).not.toBe(event.organizer)
  })

  it("copies the attached report snapshot", () => {
    store().setAttachedReport(report)
    expect(draft().attachedReport).toEqual(report)
    expect(draft().attachedReport).not.toBe(report)
  })

  it("keeps only the five serializable fields of a media item", () => {
    store().setMedia([{ ...media("a"), file: {} } as unknown as PostComposerMedia])
    expect(draft().media).toEqual([media("a")])
  })

  it("restores a captured draft as a new object", () => {
    store().setBody("hello")
    const captured = selectPostComposerDraft(usePostComposerStore.getState())
    store().reset()
    store().restore(captured)
    expect(draft()).toEqual(captured)
    expect(draft()).not.toBe(captured)
  })
})

describe("postComposerStore attachments", () => {
  it("keeps the report snapshot when the same id is set again and drops it for a different id", () => {
    store().setAttachedReport(report)
    store().setAttachedReportId("report-1")
    expect(draft().attachedReport?.id).toBe("report-1")
    store().setAttachedReportId("report-2")
    expect(draft()).toMatchObject({ attachedReportId: "report-2", attachedReport: null })
  })

  it("clears both event halves when the event is detached", () => {
    store().setAttachedEvent(event)
    store().setAttachedEvent(null)
    expect(draft()).toMatchObject({ attachedEventId: null, attachedEvent: null })
  })

  it("holds an event and a report at the same time", () => {
    store().setAttachedEvent(event)
    store().setAttachedReport(report)
    expect(draft()).toMatchObject({ attachedEventId: "event-1", attachedReportId: "report-1" })
  })
})

describe("postComposerStore media", () => {
  it("reports pending media only for pending or uploading items", () => {
    const state = () => usePostComposerStore.getState()
    store().setMedia([media("a", { status: "ready", uploadId: "u" }), media("b", { status: "failed" })])
    expect(selectPostComposerHasPendingMedia(state())).toBe(false)
    store().setMedia([media("a", { status: "ready", uploadId: "u" }), media("b", { status: "uploading" })])
    expect(selectPostComposerHasPendingMedia(state())).toBe(true)
    store().setMedia([media("a", { status: "ready", uploadId: "u" }), media("b")])
    expect(selectPostComposerHasPendingMedia(state())).toBe(true)
  })
})

describe("postComposerStore reset(keep) edges", () => {
  it("sets no target for a kept post mode", () => {
    store().setQuotePostId("q")
    store().setReplyToPostId("r")
    store().reset({ mode: "post", targetPostId: "x" })
    expect(draft()).toMatchObject({ mode: "post", quotePostId: null, replyToPostId: null })
  })

  it("keeps a reply mode with a null target when none is given", () => {
    store().reset({ mode: "reply" })
    expect(draft()).toMatchObject({ mode: "reply", replyToPostId: null, quotePostId: null })
  })

  it("clears the claimed create run as well as the draft", () => {
    store().setPendingCreate("report")
    store().claimPendingCreate("report")
    expect(usePostComposerStore.getState().claimedCreate).toBe("report")
    store().reset({ mode: "reply", targetPostId: "p" })
    expect(usePostComposerStore.getState().claimedCreate).toBeNull()
    expect(draft().pendingCreate).toBeNull()
  })
})
