/**
 * Regression coverage for the web share fallback: dismissing the browser's share sheet used to fall
 * through to the clipboard copy, so cancelling a share silently overwrote the user's clipboard and the
 * caller (ShareButton) then flashed "Link copied" for something the user had declined.
 */
import { describe, expect, it } from "vitest"
import { classifyWebShareRejection } from "../shareResult"

describe("classifyWebShareRejection", () => {
  it("treats the user dismissing the share sheet as a cancel, NOT a failure to fall back from", () => {
    // What every engine throws when the user closes the sheet.
    expect(classifyWebShareRejection({ name: "AbortError", message: "Share canceled" })).toBe("cancelled")
    // A real DOMException carries the same name.
    const abort = new Error("Abort due to cancellation of share.")
    abort.name = "AbortError"
    expect(classifyWebShareRejection(abort)).toBe("cancelled")
  })

  it("keeps the clipboard fallback for genuine share failures", () => {
    expect(classifyWebShareRejection({ name: "NotAllowedError" })).toBe("failed")
    expect(classifyWebShareRejection({ name: "DataError" })).toBe("failed")
    expect(classifyWebShareRejection(new Error("boom"))).toBe("failed")
  })

  it("does not throw on a non-object rejection", () => {
    expect(classifyWebShareRejection(undefined)).toBe("failed")
    expect(classifyWebShareRejection(null)).toBe("failed")
    expect(classifyWebShareRejection("AbortError")).toBe("failed")
  })
})
