import { describe, expect, it } from "vitest"
import { cleanupSharePath } from "../cleanupSharePath"

describe("cleanupSharePath", () => {
  it("prefers the page slug, then the reference code, then the id", () => {
    expect(cleanupSharePath({ id: "a", pageSlug: "ted-watkins" })).toBe("/cleanups/ted-watkins")
    expect(cleanupSharePath({ id: "b", referenceCode: "CF-1234" })).toBe("/cleanups/CF-1234")
    expect(cleanupSharePath({ id: "c" })).toBe("/cleanups/c")
  })

  it("falls through a null slug or reference code", () => {
    expect(cleanupSharePath({ id: "d", pageSlug: null, referenceCode: "CF-9" })).toBe("/cleanups/CF-9")
    expect(cleanupSharePath({ id: "e", pageSlug: null, referenceCode: null })).toBe("/cleanups/e")
  })
})
