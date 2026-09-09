/**
 * replyDraftStore - the keyed reply draft.
 *
 * The point of this store is that two threads can NEVER see each other's text (the single global
 * `postComposerStore` could, and did), that an unfinalized upload can never be persisted into a draft
 * that would then hold Reply disabled forever, and that the map cannot grow without bound.
 */
import { beforeEach, describe, expect, it } from "vitest"
import type { PostComposerMedia } from "../../postComposerStore"
import {
  EMPTY_REPLY_DRAFT,
  MAX_REPLY_DRAFTS,
  selectReplyHasPendingMedia,
  selectReplyMediaUploadIds,
  useReplyDraftStore,
} from "../replyDraftStore"

const media = (uri: string, status: PostComposerMedia["status"]): PostComposerMedia => ({
  uri,
  kind: "image",
  posterUri: null,
  uploadId: status === "ready" ? `upload-${uri}` : null,
  status,
})

beforeEach(() => {
  useReplyDraftStore.setState({ drafts: {} })
})

describe("replyDraftStore", () => {
  it("returns the empty draft for a thread nobody has typed into", () => {
    expect(useReplyDraftStore.getState().get("post-1")).toBe(EMPTY_REPLY_DRAFT)
  })

  it("keeps two targets' drafts fully independent", () => {
    const { setBody } = useReplyDraftStore.getState()
    setBody("post-1", "first thread")
    setBody("post-2", "second thread")

    expect(useReplyDraftStore.getState().get("post-1").body).toBe("first thread")
    expect(useReplyDraftStore.getState().get("post-2").body).toBe("second thread")

    setBody("post-1", "edited")
    expect(useReplyDraftStore.getState().get("post-2").body).toBe("second thread")
  })

  it("clearDraft removes only its own key", () => {
    const { setBody, clearDraft } = useReplyDraftStore.getState()
    setBody("post-1", "a")
    setBody("post-2", "b")

    clearDraft("post-1")

    expect(useReplyDraftStore.getState().get("post-1")).toBe(EMPTY_REPLY_DRAFT)
    expect(useReplyDraftStore.getState().get("post-2").body).toBe("b")
  })

  it("filters media that has not finished uploading at WRITE time", () => {
    useReplyDraftStore.getState().setMedia("post-1", [
      media("a", "ready"),
      media("b", "uploading"),
      media("c", "pending"),
      media("d", "failed"),
      media("e", "ready"),
    ])

    const stored = useReplyDraftStore.getState().get("post-1").media
    expect(stored.map((item) => item.uri)).toEqual(["a", "e"])
    // ...so the "spinner over a permanently disabled Reply button" state is unrepresentable.
    expect(selectReplyHasPendingMedia("post-1")(useReplyDraftStore.getState())).toBe(false)
    expect(selectReplyMediaUploadIds("post-1")(useReplyDraftStore.getState())).toEqual([
      "upload-a",
      "upload-e",
    ])
  })

  it("caps the map at MAX_REPLY_DRAFTS, evicting the oldest EMPTY draft first", () => {
    const { setBody } = useReplyDraftStore.getState()
    // 20 drafts: #0 is the oldest and is EMPTY; every other one carries text.
    setBody("post-0", "")
    for (let i = 1; i < MAX_REPLY_DRAFTS; i += 1) setBody(`post-${i}`, `body ${i}`)
    expect(Object.keys(useReplyDraftStore.getState().drafts)).toHaveLength(MAX_REPLY_DRAFTS)

    setBody("post-new", "the 21st")

    const drafts = useReplyDraftStore.getState().drafts
    expect(Object.keys(drafts)).toHaveLength(MAX_REPLY_DRAFTS)
    expect(drafts["post-0"]).toBeUndefined()
    expect(drafts["post-1"]?.body).toBe("body 1")
    expect(drafts["post-new"]?.body).toBe("the 21st")
  })

  it("evicts the oldest NON-empty draft only when nothing empty is available", () => {
    const { setBody } = useReplyDraftStore.getState()
    for (let i = 0; i < MAX_REPLY_DRAFTS; i += 1) setBody(`post-${i}`, `body ${i}`)

    setBody("post-new", "the 21st")

    const drafts = useReplyDraftStore.getState().drafts
    expect(Object.keys(drafts)).toHaveLength(MAX_REPLY_DRAFTS)
    // post-0 was written first, so it is the oldest.
    expect(drafts["post-0"]).toBeUndefined()
    expect(drafts["post-1"]?.body).toBe("body 1")
  })

  it("treats a draft carrying only an attachment as NON-empty for eviction", () => {
    const { setBody, setAttachedReportId } = useReplyDraftStore.getState()
    setAttachedReportId("post-keep", "report-1")
    // 1 + 18 + 1 = exactly MAX, so nothing is evicted until the 21st write below.
    for (let i = 0; i < MAX_REPLY_DRAFTS - 2; i += 1) setBody(`post-${i}`, `body ${i}`)
    setBody("post-empty", "")
    expect(Object.keys(useReplyDraftStore.getState().drafts)).toHaveLength(MAX_REPLY_DRAFTS)

    setBody("post-new", "overflow")

    const drafts = useReplyDraftStore.getState().drafts
    expect(drafts["post-empty"]).toBeUndefined()
    expect(drafts["post-keep"]?.attachedReportId).toBe("report-1")
  })
})
