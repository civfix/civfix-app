import { describe, it, expect, beforeEach } from "vitest"
import { useDraftReportStore, MAX_DRAFT_MEDIA } from "../draftStore"
import type { CapturedMedia } from "../../capabilities"

/**
 * Draft-store media tests. The reported bug: adding a second image/video DROPPED the first because the
 * capture step called `startFromCapture` (which RESETS the draft) for every add. The fix routes the
 * first capture through `startFromCapture` (seed) and every later one through `addCapture` (append).
 */

function cap(uri: string, over: Partial<CapturedMedia> = {}): CapturedMedia {
  return { uri, kind: "image", mime: "image/jpeg", ...over }
}

describe("draftStore media", () => {
  beforeEach(() => useDraftReportStore.getState().reset())

  it("startFromCapture seeds a fresh single-item draft and the EXIF/GPS pin", () => {
    useDraftReportStore
      .getState()
      .startFromCapture(cap("a", { location: { lat: 1, lng: 2, source: "exif" } }))
    const d = useDraftReportStore.getState().draft
    expect(d.media.map((m) => m.uri)).toEqual(["a"])
    expect(d.lat).toBe(1)
    expect(d.lng).toBe(2)
    expect(d.geomSource).toBe("exif")
    expect(d.idempotencyKey).toBeTruthy()
  })

  it("addCapture APPENDS and does NOT drop the first item (the reported bug)", () => {
    const s = useDraftReportStore.getState()
    s.startFromCapture(cap("first"))
    s.addCapture(cap("second", { kind: "video", mime: "video/mp4" }))
    expect(useDraftReportStore.getState().draft.media.map((m) => m.uri)).toEqual(["first", "second"])
    // The idempotency key minted by the first capture survives the append (no draft reset).
    expect(useDraftReportStore.getState().draft.idempotencyKey).toBeTruthy()
  })

  it("caps the media list at MAX_DRAFT_MEDIA", () => {
    const s = useDraftReportStore.getState()
    s.startFromCapture(cap("0"))
    for (let i = 1; i < MAX_DRAFT_MEDIA + 3; i++) s.addCapture(cap(String(i)))
    expect(useDraftReportStore.getState().draft.media.length).toBe(MAX_DRAFT_MEDIA)
  })

  it("removeMedia drops one item by uri, keeping the rest in order", () => {
    const s = useDraftReportStore.getState()
    s.startFromCapture(cap("a"))
    s.addCapture(cap("b"))
    s.addCapture(cap("c"))
    s.removeMedia("b")
    expect(useDraftReportStore.getState().draft.media.map((m) => m.uri)).toEqual(["a", "c"])
  })

  // Duplicate uris are real: picking the same library asset twice returns the same ph://content:// uri.
  it("mints a distinct id per media item, even for the same uri", () => {
    const s = useDraftReportStore.getState()
    s.startFromCapture(cap("same"))
    s.addCapture(cap("same"))
    const ids = useDraftReportStore.getState().draft.media.map((m) => m.id)
    expect(ids).toHaveLength(2)
    expect(ids[0]).toBeTruthy()
    expect(ids[0]).not.toBe(ids[1])
  })

  it("removeMedia by id drops only THAT copy of a duplicated uri", () => {
    const s = useDraftReportStore.getState()
    s.startFromCapture(cap("same"))
    s.addCapture(cap("same"))
    const [first] = useDraftReportStore.getState().draft.media
    s.removeMedia(first!.id)
    const media = useDraftReportStore.getState().draft.media
    expect(media).toHaveLength(1)
    expect(media[0]!.id).not.toBe(first!.id)
  })

  it("removeMedia by a legacy uri removes only the FIRST match, not every copy", () => {
    const s = useDraftReportStore.getState()
    s.startFromCapture(cap("same"))
    s.addCapture(cap("same"))
    s.removeMedia("same")
    expect(useDraftReportStore.getState().draft.media).toHaveLength(1)
  })

  it("setMediaUploadId writes onto ONE item even when two share a uri", () => {
    const s = useDraftReportStore.getState()
    s.startFromCapture(cap("same"))
    s.addCapture(cap("same"))
    const [first, second] = useDraftReportStore.getState().draft.media
    s.setMediaUploadId(first!.id, "upload-1")
    s.setMediaUploadId(second!.id, "upload-2")
    expect(useDraftReportStore.getState().draft.media.map((m) => m.uploadId)).toEqual([
      "upload-1",
      "upload-2",
    ])
  })

  // The review-step map "Reset" (issue #50) wipes the placed pin via clearLocation, returning the location
  // to unset so the routing card shows the passive "place the pin" prompt again.
  it("clearLocation wipes lat/lng (back to unset) without disturbing the rest of the draft", () => {
    const s = useDraftReportStore.getState()
    s.startFromCapture(cap("a"))
    s.setLocation(40.5, -74.2, "manual")
    expect(useDraftReportStore.getState().draft.lat).toBe(40.5)
    s.clearLocation()
    const d = useDraftReportStore.getState().draft
    expect(d.lat).toBeNull()
    expect(d.lng).toBeNull()
    // Unrelated fields survive the clear (only the coordinate is wiped).
    expect(d.media.map((m) => m.uri)).toEqual(["a"])
    expect(d.idempotencyKey).toBeTruthy()
  })
})

/**
 * The map long-press "Report an issue here" provenance (Area 3). `locationPrefilled` is a DISTINCT flag
 * from geomSource "manual": the wizard's own compact LocationStep and the ReviewStep's onDropPin /
 * onPickPlace all call setLocation(lat, lng, "manual"), so keying off geomSource would silently drop the
 * LOCATION step for every ordinary reporter who confirms a location.
 */
describe("draftStore prefilled location", () => {
  beforeEach(() => useDraftReportStore.getState().reset())

  it("defaults to false and stays false for the wizard's own setLocation calls", () => {
    expect(useDraftReportStore.getState().draft.locationPrefilled).toBe(false)
    const s = useDraftReportStore.getState()
    s.setLocation(40.5, -74.2, "manual")
    expect(useDraftReportStore.getState().draft.locationPrefilled).toBe(false)
    s.setLocation(40.5, -74.2, "device")
    expect(useDraftReportStore.getState().draft.locationPrefilled).toBe(false)
    s.setLocation(40.5, -74.2, "exif")
    expect(useDraftReportStore.getState().draft.locationPrefilled).toBe(false)
  })

  it("setPrefilledLocation records a manual point AND the flag", () => {
    useDraftReportStore.getState().setPrefilledLocation(37.7749, -122.4194)
    const d = useDraftReportStore.getState().draft
    expect(d.lat).toBe(37.7749)
    expect(d.lng).toBe(-122.4194)
    expect(d.geomSource).toBe("manual")
    expect(d.locationPrefilled).toBe(true)
  })

  it("a prefilled point SURVIVES startFromCapture and beats the capture's own EXIF fix", () => {
    const s = useDraftReportStore.getState()
    s.setPrefilledLocation(37.7749, -122.4194)
    s.startFromCapture(cap("a", { location: { lat: 1, lng: 2, source: "exif" } }))
    const d = useDraftReportStore.getState().draft
    expect(d.lat).toBe(37.7749)
    expect(d.lng).toBe(-122.4194)
    expect(d.geomSource).toBe("manual")
    expect(d.locationPrefilled).toBe(true)
    // It is still a FRESH draft otherwise (new key, only this capture).
    expect(d.media.map((m) => m.uri)).toEqual(["a"])
    expect(d.idempotencyKey).toBeTruthy()
  })

  it("an UNPREFILLED draft still resets wholesale and takes the capture's fix", () => {
    const s = useDraftReportStore.getState()
    s.setLocation(40.5, -74.2, "manual")
    s.startFromCapture(cap("a", { location: { lat: 1, lng: 2, source: "exif" } }))
    const d = useDraftReportStore.getState().draft
    expect(d.lat).toBe(1)
    expect(d.lng).toBe(2)
    expect(d.geomSource).toBe("exif")
    expect(d.locationPrefilled).toBe(false)
  })

  it("clearLocation and reset both UNPREFILL", () => {
    const s = useDraftReportStore.getState()
    s.setPrefilledLocation(37.7749, -122.4194)
    s.clearLocation()
    expect(useDraftReportStore.getState().draft.locationPrefilled).toBe(false)

    s.setPrefilledLocation(37.7749, -122.4194)
    s.reset()
    expect(useDraftReportStore.getState().draft.locationPrefilled).toBe(false)
  })
})

/**
 * "Share to the feed" lives on the DRAFT (not in component state) so it survives the tab-away/remount that
 * `resumeStep` exists for. It must default OFF, and a NEW first capture must not inherit a previous
 * report's share intent or - critically - its created post id.
 */
describe("draftStore feed share", () => {
  beforeEach(() => useDraftReportStore.getState().reset())

  it("defaults to OFF with a blank caption and no post id", () => {
    const d = useDraftReportStore.getState().draft
    expect(d.shareToFeed).toBe(false)
    expect(d.feedCaption).toBe("")
    expect(d.feedPostId).toBeNull()
  })

  it("records the toggle, the caption and the created post id", () => {
    const s = useDraftReportStore.getState()
    s.setShareToFeed(true)
    s.setFeedCaption("This has been here a week.")
    s.setFeedPostId("post-1")
    const d = useDraftReportStore.getState().draft
    expect(d).toMatchObject({
      shareToFeed: true,
      feedCaption: "This has been here a week.",
      feedPostId: "post-1",
    })
  })

  it("startFromCapture RESETS all three (a new first capture is a new report)", () => {
    const s = useDraftReportStore.getState()
    s.setShareToFeed(true)
    s.setFeedCaption("old caption")
    s.setFeedPostId("post-1")
    s.startFromCapture(cap("a"))
    const d = useDraftReportStore.getState().draft
    expect(d.shareToFeed).toBe(false)
    expect(d.feedCaption).toBe("")
    expect(d.feedPostId).toBeNull()
  })

  it("reset() clears them too", () => {
    const s = useDraftReportStore.getState()
    s.setShareToFeed(true)
    s.setFeedCaption("x")
    s.setFeedPostId("post-1")
    s.reset()
    const d = useDraftReportStore.getState().draft
    expect(d.shareToFeed).toBe(false)
    expect(d.feedCaption).toBe("")
    expect(d.feedPostId).toBeNull()
  })
})
