import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { eventCoverChanged, eventCoverErrorKey } from "../eventCoverModel"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

const detail = strip(read("../EventDetailBody.tsx"))
const form = strip(read("../CleanupForm.tsx"))
const create = strip(read("../CreateCleanupBody.tsx"))
const edit = strip(read("../EditCleanupBody.tsx"))

describe("eventCoverChanged", () => {
  it("sends a freshly uploaded cover", () => {
    expect(eventCoverChanged({ coverMediaId: "m1", coverPreviewUrl: "file:///a" }, null)).toBe(true)
    expect(eventCoverChanged({ coverMediaId: "m1", coverPreviewUrl: "file:///a" }, "https://x")).toBe(
      true,
    )
  })

  it("sends an explicit null when the host clears a cover the event already had", () => {
    expect(eventCoverChanged({ coverMediaId: null, coverPreviewUrl: null }, "https://x")).toBe(true)
  })

  it("stays OUT of the patch when the host never touched the field", () => {
    expect(eventCoverChanged({ coverMediaId: null, coverPreviewUrl: "https://x" }, "https://x")).toBe(
      false,
    )
    expect(eventCoverChanged({ coverMediaId: null, coverPreviewUrl: null }, null)).toBe(false)
    expect(eventCoverChanged({ coverMediaId: null, coverPreviewUrl: null }, undefined)).toBe(false)
  })
})

describe("eventCoverErrorKey", () => {
  it("maps the upload failures the media endpoints actually raise", () => {
    expect(eventCoverErrorKey("MEDIA_REJECTED")).toBe("cover.error_rejected")
    expect(eventCoverErrorKey("RATE_LIMITED")).toBe("cover.error_rate_limited")
    expect(eventCoverErrorKey(undefined)).toBe("cover.error_generic")
    expect(eventCoverErrorKey("NETWORK")).toBe("cover.error_generic")
  })
})

describe("the event hero", () => {
  it("renders the uploaded cover, and nothing at all without one", () => {
    const hero = detail.match(/function EventHero\([\s\S]*?\n\}/)?.[0] ?? ""
    expect(hero).toContain("const cover = cleanup.coverUrl?.trim()")
    expect(hero).toContain("if (!cover) return null")
    expect(hero).toContain('resizeMode="cover"')
    expect(hero).not.toContain("hasCoords")
    expect(detail).not.toContain("MiniMap")
    expect(detail).not.toContain("heroBlank")
  })
})

describe("the cover picker rides the shared upload seam", () => {
  it("picks from the library and finalizes through uploadMedia, never a web-only control", () => {
    expect(form).toContain("camera.pickFromLibrary()")
    expect(form).toContain("uploadMedia({ api, camera, media: picked })")
    expect(form).toContain('picked.kind !== "image"')
    expect(form).toContain("setCoverErrorKey(eventCoverErrorKey(appErrorCode(err)))")
  })

  it("keeps the uploaded id and the preview uri as two separate fields", () => {
    expect(form).toContain("coverMediaId: string | null")
    expect(form).toContain("coverPreviewUrl: string | null")
    expect(form).toContain("patch({ coverMediaId: uploaded.mediaId, coverPreviewUrl: picked.uri })")
    expect(form).toContain("patch({ coverMediaId: null, coverPreviewUrl: null })")
  })

  it("threads the id into create and the change-aware patch into edit", () => {
    expect(create).toContain("...(form.coverMediaId ? { coverMediaId: form.coverMediaId } : {})")
    expect(edit).toContain(
      "...(eventCoverChanged(form, cleanup.coverUrl) ? { coverMediaId: form.coverMediaId } : {})",
    )
    expect(edit).toContain("coverPreviewUrl: cleanup.coverUrl ?? null")
  })
})
