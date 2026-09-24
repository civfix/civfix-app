import { beforeEach, describe, expect, it } from "vitest"
import type { LinkedEventRef, LinkedReportRef, UserMentionDTO } from "@civfix/shared"
import {
  selectPostComposerDraft,
  selectPostComposerHasPendingMedia,
  selectPostComposerMediaUploadIds,
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
  it("keeps the event snapshot when the same id is set again and drops it for a different id", () => {
    store().setAttachedEvent(event)
    store().setAttachedEventId("event-1")
    expect(draft().attachedEvent?.id).toBe("event-1")
    store().setAttachedEventId("event-2")
    expect(draft()).toMatchObject({ attachedEventId: "event-2", attachedEvent: null })
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
  it("replaces a re-added uri and moves it to the end", () => {
    store().addMedia(media("a"))
    store().addMedia(media("b"))
    store().addMedia(media("a", { status: "ready", uploadId: "u-a" }))
    expect(draft().media.map((m) => [m.uri, m.status])).toEqual([
      ["b", "pending"],
      ["a", "ready"],
    ])
  })

  it("updates the status of every item sharing a uri and leaves the upload id alone", () => {
    store().setMedia([media("a", { uploadId: "u1" }), media("b")])
    store().setMediaStatus("a", "failed")
    expect(draft().media[0]).toMatchObject({ status: "failed", uploadId: "u1" })
    expect(draft().media[1]?.status).toBe("pending")
  })

  it("ignores an update for a uri that is not staged", () => {
    store().setMedia([media("a")])
    store().setMediaUpload("zz", "u", "ready")
    expect(draft().media).toEqual([media("a")])
  })

  it("reports pending media only for pending or uploading items", () => {
    const state = () => usePostComposerStore.getState()
    store().setMedia([media("a", { status: "ready", uploadId: "u" }), media("b", { status: "failed" })])
    expect(selectPostComposerHasPendingMedia(state())).toBe(false)
    store().setMediaStatus("b", "uploading")
    expect(selectPostComposerHasPendingMedia(state())).toBe(true)
    store().setMediaStatus("b", "pending")
    expect(selectPostComposerHasPendingMedia(state())).toBe(true)
  })

  it("submits only ready items that carry an upload id", () => {
    store().setMedia([
      media("a", { status: "ready", uploadId: "u-a" }),
      media("b", { status: "ready", uploadId: null }),
      media("c", { status: "failed", uploadId: "u-c" }),
      media("d", { status: "uploading", uploadId: "u-d" }),
    ])
    expect(selectPostComposerMediaUploadIds(usePostComposerStore.getState())).toEqual(["u-a"])
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
