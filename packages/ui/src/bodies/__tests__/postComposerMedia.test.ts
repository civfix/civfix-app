/**
 * The composer draft's media survives a remount ONLY because the persisted list is merged with this
 * mount's picks instead of being overwritten by the (always-empty-on-mount) local attachment hook.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type { PendingAttachment } from "../../primitives/useComposerAttachments"
import {
  POST_COMPOSER_MEDIA_CAP,
  carriedMediaIndex,
  isCarriedMediaId,
  mergePostComposerMedia,
  mergePostComposerThumbs,
  postComposerCanAttach,
  snapshotCarriedMedia,
  toPostComposerMedia,
} from "../postComposerMedia"
import type { PostComposerMedia } from "../postComposerStore"

const carried: PostComposerMedia = {
  uri: "file:///staged.jpg",
  kind: "image",
  posterUri: null,
  uploadId: "upload-1",
  status: "ready",
}

const picked: PendingAttachment = {
  id: "att-7",
  uri: "file:///fresh.jpg",
  kind: "image",
  posterUri: null,
  uploadId: "upload-2",
}

describe("post composer media merge", () => {
  it("keeps the persisted draft media when the composer remounts with an empty pick list", () => {
    // The regression: an empty local hook used to overwrite the draft, orphaning finalized uploadIds.
    expect(mergePostComposerMedia([carried], [])).toEqual([carried])
    expect(mergePostComposerThumbs([carried], [])).toEqual([
      { id: "carried:0:file:///staged.jpg", uri: carried.uri, kind: "image", posterUri: null, uploadId: "upload-1" },
    ])
  })

  it("appends this mount's picks after the carried items and caps the total", () => {
    expect(mergePostComposerMedia([carried], [picked])).toEqual([carried, toPostComposerMedia(picked)])
    const many = Array.from({ length: 6 }, (_, i) => ({ ...picked, id: `att-${i}`, uri: `file:///${i}.jpg` }))
    expect(mergePostComposerMedia([carried], many)).toHaveLength(POST_COMPOSER_MEDIA_CAP)
    expect(mergePostComposerThumbs([carried], many)).toHaveLength(POST_COMPOSER_MEDIA_CAP)
  })

  it("marks a not-yet-finalized pick as uploading, and a finalized one as ready", () => {
    expect(toPostComposerMedia({ id: "att-1", uri: "file:///a.jpg", kind: "image" })).toMatchObject({
      uploadId: null,
      status: "uploading",
      posterUri: null,
    })
    expect(toPostComposerMedia(picked)).toMatchObject({ uploadId: "upload-2", status: "ready" })
  })

  it("routes a remove to the right source via the thumb id", () => {
    const [carriedThumb, pickedThumb] = mergePostComposerThumbs([carried], [picked])
    expect(isCarriedMediaId(carriedThumb!.id)).toBe(true)
    expect(carriedMediaIndex(carriedThumb!.id)).toBe(0)
    expect(isCarriedMediaId(pickedThumb!.id)).toBe(false)
    expect(carriedMediaIndex(pickedThumb!.id)).toBeNull()
  })

  it("gives the SAME asset picked twice two distinct carried keys", () => {
    // The regression: keying on the uri alone produced duplicate React keys, and removing one thumb
    // filtered on that uri — deleting both copies at once.
    const twin = { ...carried, uploadId: "upload-2" }
    const thumbs = mergePostComposerThumbs([carried, twin], [])
    expect(thumbs.map((thumb) => thumb.id)).toEqual([
      "carried:0:file:///staged.jpg",
      "carried:1:file:///staged.jpg",
    ])
    expect(new Set(thumbs.map((thumb) => thumb.id)).size).toBe(2)
    expect(carriedMediaIndex(thumbs[1]!.id)).toBe(1)
  })
})

describe("carried media snapshot", () => {
  const unfinished: PostComposerMedia = {
    uri: "file:///half.jpg",
    kind: "image",
    posterUri: null,
    uploadId: null,
    status: "uploading",
  }

  it("keeps finalized items untouched", () => {
    expect(snapshotCarriedMedia([carried])).toEqual({ carried: [carried], dropped: 0 })
  })

  it("drops an upload that can never finish and reports how many went", () => {
    // The regression: the pipeline that would have written this item's uploadId died with the mount that
    // picked it, so carrying it forward spun its thumbnail forever and kept Post disabled for good.
    expect(snapshotCarriedMedia([carried, unfinished])).toEqual({ carried: [carried], dropped: 1 })
    expect(snapshotCarriedMedia([unfinished, { ...unfinished, status: "failed" }])).toEqual({
      carried: [],
      dropped: 2,
    })
  })

  it("does not trust a status of ready without an uploadId (nothing to submit)", () => {
    expect(snapshotCarriedMedia([{ ...unfinished, status: "ready" }])).toEqual({ carried: [], dropped: 1 })
  })

  it("is a no-op for an empty draft", () => {
    expect(snapshotCarriedMedia([])).toEqual({ carried: [], dropped: 0 })
  })
})

describe("postComposerCanAttach", () => {
  it("counts carried draft media against the cap, not just this mount's picks", () => {
    // Two carried + two picked is full: the hook alone (2 of 4 picks) would still open the picker, and
    // the merge would then slice the fifth item off after it uploaded.
    expect(postComposerCanAttach({ hookCanAttach: true, carried: 2, picked: 2 })).toBe(false)
    expect(postComposerCanAttach({ hookCanAttach: true, carried: 2, picked: 1 })).toBe(true)
    expect(postComposerCanAttach({ hookCanAttach: true, carried: 0, picked: POST_COMPOSER_MEDIA_CAP })).toBe(false)
  })

  it("never overrides the hook's own refusal (no camera, busy, or its own cap)", () => {
    expect(postComposerCanAttach({ hookCanAttach: false, carried: 0, picked: 0 })).toBe(false)
  })

  it("is what BOTH composers gate the add-media control on", () => {
    for (const file of ["../PostComposer.tsx", "../feed/InlineComposer.tsx"]) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8")
      expect(source, file).toMatch(/const canAttachMedia = postComposerCanAttach\(\{/)
      expect(source, file).toContain("disabled={!canAttachMedia}")
      expect(source, file).not.toContain("disabled={!attachments.canAttach}")
    }
  })
})
