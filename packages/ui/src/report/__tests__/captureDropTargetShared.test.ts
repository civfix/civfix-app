import { describe, expect, it } from "vitest"
import { isDroppableType } from "../captureDropTarget.shared"

describe("isDroppableType", () => {
  it("accepts any image or video MIME type", () => {
    for (const type of ["image/jpeg", "image/png", "image/heic", "video/mp4", "video/quicktime"]) {
      expect(isDroppableType(type)).toBe(true)
    }
  })

  it("accepts a missing or empty type, which some browsers report for unmapped files", () => {
    expect(isDroppableType("")).toBe(true)
    expect(isDroppableType(null)).toBe(true)
    expect(isDroppableType(undefined)).toBe(true)
  })

  it("rejects every other family", () => {
    for (const type of ["text/plain", "application/pdf", "audio/mpeg", "text/uri-list", "Files"]) {
      expect(isDroppableType(type)).toBe(false)
    }
  })

  it("matches the family prefix case-sensitively and only at the start", () => {
    expect(isDroppableType("IMAGE/JPEG")).toBe(false)
    expect(isDroppableType("application/image/png")).toBe(false)
    expect(isDroppableType("image")).toBe(false)
  })
})
