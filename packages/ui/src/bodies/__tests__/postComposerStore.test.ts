import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { LinkedEventRef, UserMentionDTO } from "@civfix/shared"
import {
  selectPostComposerDraft,
  selectPostComposerDraftHidden,
  selectPostComposerDraftOwner,
  selectPostComposerMediaUploadIds,
  selectPostComposerMentionedUserIds,
  selectPostComposerTargetId,
  usePostComposerStore,
} from "../postComposerStore"

const maya: UserMentionDTO = { id: "maya", handle: "mayal", displayName: "Maya Lopez" }
const dev: UserMentionDTO = { id: "dev", handle: "devp", displayName: "Dev Patel" }
const selectedEvent: LinkedEventRef = {
  id: "event-1",
  title: "Neighborhood garden cleanup",
  eventKind: "cleanup",
  status: "upcoming",
  scheduledAt: "2026-07-25T17:00:00.000Z",
  lat: 34.0522,
  lng: -118.2437,
  going: 18,
  organizer: {
    id: "organizer-1",
    name: "Maya Lopez",
    followers: 42,
    following: 7,
    isFollowing: false,
  },
  linkedAt: "2026-07-21T18:30:00.000Z",
}

beforeEach(() => usePostComposerStore.getState().reset())

describe("postComposerStore", () => {
  it("keeps a serializable draft alive outside a composer mount", () => {
    const store = usePostComposerStore.getState()
    store.setBody("Meeting @mayal at the river")
    store.toggleMention(maya)
    store.setAttachedEventId("event-1")
    store.setAttachedReportId("report-1")

    expect(usePostComposerStore.getState().draft).toEqual({
      body: "Meeting @mayal at the river",
      mentionedUsers: [maya],
      attachedEventId: "event-1",
      attachedEvent: null,
      attachedReportId: "report-1",
      attachedReport: null,
      media: [],
      mode: "post",
      quotePostId: null,
      replyToPostId: null,
      organizationId: null,
      pendingCreate: null,
      ownerId: null,
    })
  })

  it("toggles mentions by user id and exposes ids for post submission", () => {
    const store = usePostComposerStore.getState()
    store.toggleMention(maya)
    store.toggleMention(dev)
    store.toggleMention({ ...maya, displayName: "Updated Maya" })

    expect(usePostComposerStore.getState().draft.mentionedUsers).toEqual([dev])
    expect(selectPostComposerMentionedUserIds(usePostComposerStore.getState())).toEqual(["dev"])
  })

  it("stores the selected event preview with its submission id", () => {
    usePostComposerStore.getState().setAttachedEvent(selectedEvent)

    expect(usePostComposerStore.getState().draft).toMatchObject({
      attachedEventId: selectedEvent.id,
      attachedEvent: selectedEvent,
    })
  })

  it("tracks media upload ids and status without retaining non-serializable upload objects", () => {
    const store = usePostComposerStore.getState()
    store.addMedia({
      uri: "file:///cleanup.jpg",
      kind: "image",
      posterUri: null,
      uploadId: null,
      status: "uploading",
    })
    store.addMedia({
      uri: "file:///before.mp4",
      kind: "video",
      posterUri: "file:///before-poster.jpg",
      uploadId: "upload-2",
      status: "ready",
    })
    store.setMediaUpload("file:///cleanup.jpg", "upload-1", "ready")

    expect(usePostComposerStore.getState().draft.media).toEqual([
      {
        uri: "file:///cleanup.jpg",
        kind: "image",
        posterUri: null,
        uploadId: "upload-1",
        status: "ready",
      },
      {
        uri: "file:///before.mp4",
        kind: "video",
        posterUri: "file:///before-poster.jpg",
        uploadId: "upload-2",
        status: "ready",
      },
    ])
    expect(selectPostComposerMediaUploadIds(usePostComposerStore.getState())).toEqual(["upload-1", "upload-2"])

    store.removeMedia("file:///cleanup.jpg")
    expect(usePostComposerStore.getState().draft.media.map((media) => media.uri)).toEqual(["file:///before.mp4"])
  })

  it("keeps quote and reply target ids separate while mode selects the active target", () => {
    const store = usePostComposerStore.getState()
    store.setQuotePostId("post-quote")
    store.setReplyToPostId("post-reply")

    store.setMode("quote")
    expect(selectPostComposerTargetId(usePostComposerStore.getState())).toBe("post-quote")

    store.setMode("reply")
    expect(selectPostComposerTargetId(usePostComposerStore.getState())).toBe("post-reply")

    store.setMode("post")
    expect(selectPostComposerTargetId(usePostComposerStore.getState())).toBeNull()
  })

  it("resets every draft field after publishing or discarding", () => {
    const store = usePostComposerStore.getState()
    store.setBody("Ready to publish")
    store.toggleMention(maya)
    store.setAttachedEventId("event-1")
    store.addMedia({ uri: "file:///cleanup.jpg", kind: "image", posterUri: null, uploadId: "upload-1", status: "ready" })
    store.setQuotePostId("post-1")
    store.setMode("quote")

    store.reset()

    expect(usePostComposerStore.getState().draft).toEqual({
      body: "",
      mentionedUsers: [],
      attachedEventId: null,
      attachedEvent: null,
      attachedReportId: null,
      attachedReport: null,
      media: [],
      mode: "post",
      quotePostId: null,
      replyToPostId: null,
      organizationId: null,
      pendingCreate: null,
      ownerId: null,
    })
  })

  it("reset(keep) clears the draft but re-stamps a mounted reply composer's mode and target", () => {
    // The compact reply composer stays MOUNTED across submits. A bare reset() flips the draft back to
    // mode "post" with no reply target, so the SECOND reply would silently publish as a top-level post.
    const store = usePostComposerStore.getState()
    store.setMode("reply")
    store.setReplyToPostId("post-parent")
    store.setBody("First reply")
    store.setAttachedReportId("report-1")

    store.reset({ mode: "reply", targetPostId: "post-parent" })

    expect(usePostComposerStore.getState().draft).toEqual({
      body: "",
      mentionedUsers: [],
      attachedEventId: null,
      attachedEvent: null,
      attachedReportId: null,
      attachedReport: null,
      media: [],
      mode: "reply",
      quotePostId: null,
      replyToPostId: "post-parent",
      organizationId: null,
      pendingCreate: null,
      ownerId: null,
    })
    expect(selectPostComposerTargetId(usePostComposerStore.getState())).toBe("post-parent")
  })

  it("carries the chosen author organization across a reset, and a genuine exit keeps it too", () => {
    const store = usePostComposerStore.getState()
    store.setOrganizationId("org-1")
    store.setBody("Posting on behalf of the trust")

    store.reset()
    expect(usePostComposerStore.getState().draft.organizationId).toBe("org-1")
    expect(usePostComposerStore.getState().draft.body).toBe("")

    store.reset({ mode: "reply", targetPostId: "post-parent" })
    expect(usePostComposerStore.getState().draft.organizationId).toBe("org-1")

    usePostComposerStore.getState().discardAttachments()
    expect(usePostComposerStore.getState().draft.organizationId).toBe("org-1")

    usePostComposerStore.getState().setOrganizationId(null)
    expect(usePostComposerStore.getState().draft.organizationId).toBeNull()
  })

  it("adoptViewer wipes what the previous viewer wrote when a different account arrives", () => {
    usePostComposerStore.getState().adoptViewer("user-a")
    const store = usePostComposerStore.getState()
    store.setOrganizationId("org-a")
    store.setBody("Private note from @mayal")
    store.toggleMention(maya)
    store.setAttachedEvent(selectedEvent)
    store.setPendingCreate("report")
    store.claimPendingCreate("report")

    usePostComposerStore.getState().adoptViewer("user-b")
    expect(usePostComposerStore.getState().draft).toEqual({
      body: "",
      mentionedUsers: [],
      attachedEventId: null,
      attachedEvent: null,
      attachedReportId: null,
      attachedReport: null,
      media: [],
      mode: "post",
      organizationId: null,
      quotePostId: null,
      replyToPostId: null,
      pendingCreate: null,
      ownerId: null,
    })
    expect(usePostComposerStore.getState().claimedCreate).toBeNull()
    usePostComposerStore.getState().adoptViewer(null)
  })

  it("a viewer change keeps the mounted composer's reply target", () => {
    usePostComposerStore.getState().adoptViewer("user-a")
    usePostComposerStore.getState().reset({ mode: "reply", targetPostId: "post-parent" })
    usePostComposerStore.getState().setBody("Replying as a")

    usePostComposerStore.getState().adoptViewer("user-b")
    expect(usePostComposerStore.getState().draft).toMatchObject({
      body: "",
      mode: "reply",
      replyToPostId: "post-parent",
      quotePostId: null,
    })
    usePostComposerStore.getState().adoptViewer(null)
  })

  it("keeps a signed-in author's draft through a transient loss of the viewer, hidden meanwhile", () => {
    usePostComposerStore.getState().adoptViewer("user-a")
    usePostComposerStore.getState().setOrganizationId("org-a")
    usePostComposerStore.getState().setBody("A long draft")

    usePostComposerStore.getState().adoptViewer(null)
    expect(selectPostComposerDraft(usePostComposerStore.getState()).body).toBe("")
    expect(selectPostComposerDraft(usePostComposerStore.getState()).organizationId).toBeNull()
    usePostComposerStore.getState().setBody("typed by nobody")

    usePostComposerStore.getState().adoptViewer("user-a")
    expect(selectPostComposerDraft(usePostComposerStore.getState())).toMatchObject({
      body: "A long draft",
      organizationId: "org-a",
    })

    usePostComposerStore.getState().adoptViewer("user-a")
    expect(usePostComposerStore.getState().draft.body).toBe("A long draft")
    usePostComposerStore.getState().discardViewerDraft()
    usePostComposerStore.getState().adoptViewer(null)
  })

  it("an explicit sign-out wipes the draft but keeps the composer's route", () => {
    usePostComposerStore.getState().adoptViewer("user-a")
    usePostComposerStore.getState().reset({ mode: "quote", targetPostId: "post-quoted" })
    usePostComposerStore.getState().setBody("Quote by a")
    usePostComposerStore.getState().setOrganizationId("org-a")

    usePostComposerStore.getState().discardViewerDraft()
    usePostComposerStore.getState().adoptViewer(null)
    usePostComposerStore.getState().adoptViewer("user-a")

    expect(usePostComposerStore.getState().draft).toMatchObject({
      body: "",
      organizationId: null,
      mode: "quote",
      quotePostId: "post-quoted",
    })
    usePostComposerStore.getState().adoptViewer(null)
  })

  it("restore drops a staged draft once its author is no longer the viewer", () => {
    usePostComposerStore.getState().adoptViewer("user-a")
    usePostComposerStore.getState().setBody("Posted by a")
    const staged = usePostComposerStore.getState().draft
    usePostComposerStore.getState().reset({ mode: "post", targetPostId: null })

    // A 401 during the create: the host signs the viewer out before the mutation's onError runs.
    usePostComposerStore.getState().discardViewerDraft()
    usePostComposerStore.getState().adoptViewer(null)
    usePostComposerStore.getState().restore(staged)

    expect(usePostComposerStore.getState().draft.body).toBe("")
    usePostComposerStore.getState().adoptViewer("user-b")
    expect(selectPostComposerDraft(usePostComposerStore.getState()).body).toBe("")
    usePostComposerStore.getState().adoptViewer(null)
  })

  it("reset(keep) routes a quote target to quotePostId, never replyToPostId", () => {
    usePostComposerStore.getState().reset({ mode: "quote", targetPostId: "post-quoted" })

    expect(usePostComposerStore.getState().draft).toMatchObject({
      mode: "quote",
      quotePostId: "post-quoted",
      replyToPostId: null,
    })
  })
})

/**
 * The create-and-return round trip: the composer leaves to build a report/event and comes back with it
 * attached. The draft is module-level precisely so it survives that navigation, and the intent has to
 * survive with it (launching the report wizard is `selectView`, which clears the detail stack).
 */
describe("postComposerStore create round trip", () => {
  const reportRef = {
    id: "report-9",
    category: "hazard" as const,
    type: "pavement" as const,
    title: "Pothole on Sunset",
    status: "published" as const,
    lat: 34.09,
    lng: -118.28,
    addr: "Sunset Blvd",
    thumbUrl: "file:///local-capture.jpg",
    linkedAt: "2026-07-26T00:00:00.000Z",
  }

  it("carries the pending intent alongside a half-written body", () => {
    const store = usePostComposerStore.getState()
    store.setBody("Just filed this:")
    store.setPendingCreate("report")

    expect(usePostComposerStore.getState().draft).toMatchObject({
      body: "Just filed this:",
      pendingCreate: "report",
    })
  })

  it("attaches a report BY SNAPSHOT and sets the id in lock-step", () => {
    usePostComposerStore.getState().setAttachedReport(reportRef)

    expect(usePostComposerStore.getState().draft).toMatchObject({
      attachedReportId: "report-9",
      attachedReport: reportRef,
    })
  })

  // The snapshot is what makes a JUST-CREATED report survive: the composer's stale-attachment guard runs
  // against the loaded useMyReports pages, which will not contain it yet.
  it("drops a snapshot that does not belong to a newly set id", () => {
    const store = usePostComposerStore.getState()
    store.setAttachedReport(reportRef)
    store.setAttachedReportId("report-other")

    expect(usePostComposerStore.getState().draft).toMatchObject({
      attachedReportId: "report-other",
      attachedReport: null,
    })
  })

  it("keeps the snapshot when the same id is re-set", () => {
    const store = usePostComposerStore.getState()
    store.setAttachedReport(reportRef)
    store.setAttachedReportId("report-9")

    expect(usePostComposerStore.getState().draft.attachedReport).toEqual(reportRef)
  })

  it("detaching by id clears both halves", () => {
    const store = usePostComposerStore.getState()
    store.setAttachedReport(reportRef)
    store.setAttachedReportId(null)

    expect(usePostComposerStore.getState().draft).toMatchObject({
      attachedReportId: null,
      attachedReport: null,
    })
  })

  it("reset clears the pending intent so an abandoned round trip cannot fire later", () => {
    const store = usePostComposerStore.getState()
    store.setPendingCreate("event")
    store.reset()

    expect(usePostComposerStore.getState().draft.pendingCreate).toBeNull()
  })

  // THE ARMED INTENT IS NOT AN ANSWER TO "was THIS run launched from the composer?". A run takes ownership of
  // it at activation, so an abandoned launch cannot be picked up by an unrelated one later. The full lifetime
  // (including the race with the composer's exit discard) is in postComposerExit.test.ts.
  it("claiming moves the intent from ARMED to CLAIMED, atomically", () => {
    const store = usePostComposerStore.getState()
    store.setPendingCreate("report")
    store.claimPendingCreate("report")

    expect(usePostComposerStore.getState().claimedCreate).toBe("report")
    expect(usePostComposerStore.getState().draft.pendingCreate).toBeNull()
  })

  it("claiming is idempotent and never invents a claim of its own", () => {
    const store = usePostComposerStore.getState()
    // Nothing armed: a run that was not launched from the composer claims nothing.
    store.claimPendingCreate("report")
    expect(usePostComposerStore.getState().claimedCreate).toBeNull()

    store.setPendingCreate("report")
    store.claimPendingCreate("report")
    store.claimPendingCreate("report")
    expect(usePostComposerStore.getState().claimedCreate).toBe("report")
    // A remount re-claiming must not re-arm, or the latch would be back.
    expect(usePostComposerStore.getState().draft.pendingCreate).toBeNull()
  })

  it("releasing is kind-scoped, so a departing run cannot drop somebody else's claim", () => {
    const store = usePostComposerStore.getState()
    store.setPendingCreate("event")
    store.claimPendingCreate("event")

    store.releaseClaimedCreate("report")
    expect(usePostComposerStore.getState().claimedCreate).toBe("event")

    store.releaseClaimedCreate("event")
    expect(usePostComposerStore.getState().claimedCreate).toBeNull()
  })

  it("reset clears a CLAIMED run too", () => {
    const store = usePostComposerStore.getState()
    store.setPendingCreate("report")
    store.claimPendingCreate("report")
    store.reset()

    expect(usePostComposerStore.getState().claimedCreate).toBeNull()
  })

  // Closing the composer: the SELECTIONS go, the prose stays. See postComposerExit.ts for what counts as a
  // close, and postComposerExit.test.ts for the discard driven through the real exit rule.
  it("discardAttachments drops attachments, media and intent while keeping body and mentions", () => {
    const store = usePostComposerStore.getState()
    store.setBody("Look at this @mayal")
    store.toggleMention(maya)
    store.setAttachedEvent(selectedEvent)
    store.setAttachedReport(reportRef)
    store.addMedia({ uri: "file:///cleanup.jpg", kind: "image", posterUri: null, uploadId: "upload-1", status: "ready" })
    store.setMode("reply")
    store.setReplyToPostId("post-parent")
    store.setQuotePostId("post-quoted")
    store.setPendingCreate("event")

    store.discardAttachments()

    expect(usePostComposerStore.getState().draft).toEqual({
      body: "Look at this @mayal",
      mentionedUsers: [maya],
      attachedEventId: null,
      attachedEvent: null,
      attachedReportId: null,
      attachedReport: null,
      media: [],
      mode: "reply",
      quotePostId: "post-quoted",
      replyToPostId: "post-parent",
      organizationId: null,
      pendingCreate: null,
      ownerId: null,
    })
  })

  // Submit clears the draft on DISPATCH (so dismissing mid-flight cannot leave a copy to publish twice);
  // a failed create puts it back rather than eating the user's text.
  it("restore puts a captured draft back verbatim", () => {
    const store = usePostComposerStore.getState()
    store.setBody("Text that must survive a failed post")
    store.setAttachedReport(reportRef)
    const staged = usePostComposerStore.getState().draft

    store.reset()
    expect(usePostComposerStore.getState().draft.body).toBe("")

    usePostComposerStore.getState().restore(staged)
    expect(usePostComposerStore.getState().draft).toEqual(staged)
  })
})

describe("postComposerStore viewer scope", () => {
  afterEach(() => {
    usePostComposerStore.getState().discardViewerDraft()
    usePostComposerStore.getState().adoptViewer(null)
  })

  it("names the draft's owner, or the viewer a fresh draft will belong to, as a stable mount key", () => {
    usePostComposerStore.getState().adoptViewer("user-a")
    expect(selectPostComposerDraftOwner(usePostComposerStore.getState())).toBe("user-a")
    usePostComposerStore.getState().setBody("typed by a")
    expect(selectPostComposerDraftOwner(usePostComposerStore.getState())).toBe("user-a")

    usePostComposerStore.getState().adoptViewer(null)
    expect(selectPostComposerDraftOwner(usePostComposerStore.getState())).toBe("user-a")

    usePostComposerStore.getState().adoptViewer("user-b")
    expect(selectPostComposerDraftOwner(usePostComposerStore.getState())).toBe("user-b")

    usePostComposerStore.getState().discardViewerDraft()
    usePostComposerStore.getState().adoptViewer(null)
    expect(selectPostComposerDraftOwner(usePostComposerStore.getState())).toBeNull()
  })

  it("reports a signed-in author's draft as hidden only while another viewer (or none) is current", () => {
    usePostComposerStore.getState().adoptViewer("user-a")
    usePostComposerStore.getState().setBody("typed by a")
    expect(selectPostComposerDraftHidden(usePostComposerStore.getState())).toBe(false)

    usePostComposerStore.getState().adoptViewer(null)
    expect(selectPostComposerDraftHidden(usePostComposerStore.getState())).toBe(true)

    usePostComposerStore.getState().adoptViewer("user-a")
    expect(selectPostComposerDraftHidden(usePostComposerStore.getState())).toBe(false)

    usePostComposerStore.getState().discardViewerDraft()
    usePostComposerStore.getState().adoptViewer(null)
    expect(selectPostComposerDraftHidden(usePostComposerStore.getState())).toBe(false)
  })
})
