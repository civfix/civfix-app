import { beforeEach, describe, expect, it } from "vitest"
import { MAX_DRAFT_MEDIA, useDraftReportStore } from "../draftStore"
import type { CapturedMedia } from "../../capabilities"

function cap(uri: string, over: Partial<CapturedMedia> = {}): CapturedMedia {
  return { uri, kind: "image", mime: "image/jpeg", ...over }
}

const store = () => useDraftReportStore.getState()
const draft = () => useDraftReportStore.getState().draft

beforeEach(() => store().reset())

describe("draftStore idempotency key", () => {
  it("mints a key once and returns the same key on every later call", () => {
    const first = store().ensureIdempotencyKey()
    expect(first).toMatch(/^[0-9a-f-]{36}$/)
    expect(store().ensureIdempotencyKey()).toBe(first)
    expect(draft().idempotencyKey).toBe(first)
  })

  it("keeps the key across category, text, flag and location edits", () => {
    const key = store().ensureIdempotencyKey()
    store().setCategory("trash", "Dump", "dump")
    store().setTitle("t")
    store().setDescription("d")
    store().setFlag("safetyHazard", true)
    store().setLocation(1, 2, "manual")
    store().addMedia({ uri: "u", kind: "image", mime: "image/jpeg" })
    expect(draft().idempotencyKey).toBe(key)
  })

  it("mints a fresh key on a first capture and drops it on reset", () => {
    const key = store().ensureIdempotencyKey()
    store().startFromCapture(cap("a"))
    const captureKey = draft().idempotencyKey
    expect(captureKey).toBeTruthy()
    expect(captureKey).not.toBe(key)
    store().reset()
    expect(draft().idempotencyKey).toBeNull()
  })
})

describe("draftStore category and title", () => {
  it("writes the category, the type id and the default title on an untouched draft", () => {
    store().setCategory("hazard", "Pavement distress", "pavement")
    expect(draft()).toMatchObject({
      category: "hazard",
      reportTypeId: "pavement",
      title: "Pavement distress",
      titleEdited: false,
    })
  })

  it("replaces the default title when the type changes and the reporter never typed one", () => {
    store().setCategory("hazard", "Pavement distress", "pavement")
    store().setCategory("trash", "Dump", "dump")
    expect(draft().title).toBe("Dump")
  })

  it("keeps a typed title across a type change", () => {
    store().setCategory("hazard", "Pavement distress", "pavement")
    store().setTitle("Crater on 5th")
    store().setCategory("trash", "Dump", "dump")
    expect(draft()).toMatchObject({ title: "Crater on 5th", titleEdited: true, category: "trash" })
  })

  it("keeps the edited flag even when the reporter clears the title", () => {
    store().setTitle("")
    store().setCategory("trash", "Dump", "dump")
    expect(draft()).toMatchObject({ title: "", titleEdited: true })
  })

  it("keeps the previous type id when a category change names none", () => {
    store().setCategory("hazard", "Pavement distress", "pavement")
    store().setCategory("trash", "Trash")
    expect(draft()).toMatchObject({ category: "trash", reportTypeId: "pavement", title: "Trash" })
  })
})

describe("draftStore description and flags", () => {
  it("stores the description verbatim, whitespace included", () => {
    store().setDescription("  two chairs \n")
    expect(draft().description).toBe("  two chairs \n")
  })

  it("sets each flag independently and can clear it again", () => {
    store().setFlag("blockingSidewalk", true)
    expect(draft().flags).toEqual({ blockingSidewalk: true, safetyHazard: false })
    store().setFlag("safetyHazard", true)
    store().setFlag("blockingSidewalk", false)
    expect(draft().flags).toEqual({ blockingSidewalk: false, safetyHazard: true })
  })

  it("resets to fresh flags that a later set cannot leak into the next draft", () => {
    store().setFlag("safetyHazard", true)
    store().reset()
    const afterReset = draft().flags
    store().setFlag("blockingSidewalk", true)
    store().reset()
    expect(afterReset).toEqual({ blockingSidewalk: false, safetyHazard: false })
    expect(draft().flags).toEqual({ blockingSidewalk: false, safetyHazard: false })
  })
})

describe("draftStore location writes", () => {
  it("records the geometry source the caller names", () => {
    store().setLocation(1, 2, "exif")
    expect(draft()).toMatchObject({ lat: 1, lng: 2, geomSource: "exif" })
    store().setLocation(3, 4, "manual")
    expect(draft()).toMatchObject({ lat: 3, lng: 4, geomSource: "manual" })
  })

  it("keeps the earlier capture time when a location write names none", () => {
    store().setLocation(1, 2, "device", "2026-09-01T10:00:00.000Z")
    store().setLocation(3, 4, "manual")
    expect(draft().capturedAt).toBe("2026-09-01T10:00:00.000Z")
  })

  it("stamps a capture time on the first capture", () => {
    const before = Date.now()
    store().startFromCapture(cap("a"))
    const stamped = Date.parse(draft().capturedAt ?? "")
    expect(stamped).toBeGreaterThanOrEqual(before)
    expect(stamped).toBeLessThanOrEqual(Date.now())
  })

  it("leaves geomSource untouched when the location is cleared", () => {
    store().setLocation(1, 2, "exif")
    store().clearLocation()
    expect(draft()).toMatchObject({ lat: null, lng: null, geomSource: "exif" })
  })

  it("defaults a fresh draft to the device source with no point", () => {
    expect(draft()).toMatchObject({ lat: null, lng: null, geomSource: "device" })
  })

  it("keeps the default device source for a capture that carried no fix", () => {
    store().setLocation(1, 2, "manual")
    store().startFromCapture(cap("a"))
    expect(draft()).toMatchObject({ lat: null, lng: null, geomSource: "device" })
  })
})

describe("draftStore location and media coupling", () => {
  it("currently keeps the removed capture's EXIF point when that capture is removed", () => {
    store().startFromCapture(cap("a", { location: { lat: 1, lng: 2, source: "exif" } }))
    store().addCapture(cap("b"))
    store().removeMedia(draft().media[0]?.id ?? "")
    expect(draft().media.map((m) => m.uri)).toEqual(["b"])
    expect(draft()).toMatchObject({ lat: 1, lng: 2, geomSource: "exif" })
  })

  it("currently keeps the point after every capture is removed", () => {
    store().startFromCapture(cap("a", { location: { lat: 1, lng: 2, source: "exif" } }))
    store().removeMedia("a")
    expect(draft().media).toEqual([])
    expect(draft()).toMatchObject({ lat: 1, lng: 2, geomSource: "exif" })
  })

  it("currently wipes category, title and description when a capture follows removing every capture", () => {
    store().startFromCapture(cap("a", { location: { lat: 1, lng: 2, source: "exif" } }))
    store().setCategory("trash", "Dump", "dump")
    store().setTitle("Couch")
    store().setDescription("Blue couch")
    store().removeMedia("a")
    store().startFromCapture(cap("b"))
    expect(draft()).toMatchObject({
      category: null,
      reportTypeId: null,
      title: "",
      titleEdited: false,
      description: "",
      lat: null,
      lng: null,
      geomSource: "device",
    })
    expect(draft().media.map((m) => m.uri)).toEqual(["b"])
  })

  it("does nothing when removeMedia names neither an id nor a uri in the draft", () => {
    store().startFromCapture(cap("a"))
    const before = draft()
    store().removeMedia("missing")
    expect(draft()).toBe(before)
  })
})

describe("draftStore media helpers", () => {
  it("setMedia replaces the whole list with one item carrying a fresh id", () => {
    store().startFromCapture(cap("a"))
    store().addCapture(cap("b"))
    store().setMedia({ uri: "c", kind: "video", mime: "video/mp4", durationSec: 3 })
    expect(draft().media).toHaveLength(1)
    expect(draft().media[0]).toMatchObject({ uri: "c", kind: "video", mime: "video/mp4", durationSec: 3 })
    expect(draft().media[0]?.id).toBeTruthy()
  })

  it("addMedia appends and caps at MAX_DRAFT_MEDIA, dropping the newest overflow", () => {
    for (let i = 0; i < MAX_DRAFT_MEDIA + 2; i++) {
      store().addMedia({ uri: String(i), kind: "image", mime: "image/jpeg" })
    }
    expect(draft().media.map((m) => m.uri)).toEqual(["0", "1", "2", "3", "4"])
  })

  it("copies only the dimensions a capture defines", () => {
    store().startFromCapture(cap("a", { width: 640, height: 480 }))
    store().addCapture(cap("b", { kind: "video", mime: "video/mp4", durationSec: 7 }))
    const [a, b] = draft().media
    expect(a).toMatchObject({ uri: "a", width: 640, height: 480 })
    expect(a).not.toHaveProperty("durationSec")
    expect(b).toMatchObject({ uri: "b", durationSec: 7 })
    expect(b).not.toHaveProperty("width")
  })

  it("never copies the capture's location onto the media item", () => {
    store().startFromCapture(cap("a", { location: { lat: 1, lng: 2, source: "device" } }))
    expect(draft().media[0]).not.toHaveProperty("location")
  })

  it("ignores setMediaUploadId for an id that is not in the draft", () => {
    store().startFromCapture(cap("a"))
    store().setMediaUploadId("nope", "up-1")
    expect(draft().media[0]).not.toHaveProperty("uploadId")
  })
})

describe("draftStore fresh-seed counter", () => {
  it("bumps on reset and on a prefilled location, and nowhere else", () => {
    const start = store().freshSeeds
    store().reset()
    expect(store().freshSeeds).toBe(start + 1)
    store().setPrefilledLocation(1, 2)
    expect(store().freshSeeds).toBe(start + 2)
    store().setLocation(3, 4, "manual")
    store().startFromCapture(cap("a"))
    store().addCapture(cap("b"))
    store().clearLocation()
    expect(store().freshSeeds).toBe(start + 2)
  })
})
