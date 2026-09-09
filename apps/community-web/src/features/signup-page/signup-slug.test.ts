import { describe, expect, it } from "vitest"

import { accessCodeFromSearch, signupPath, signupSlugFromPath } from "./signup-slug"

describe("signupSlugFromPath", () => {
  it("reads the page slug", () => {
    expect(signupSlugFromPath("/e/beach-cleanup-may/")).toEqual({
      kind: "slug",
      slug: "beach-cleanup-may",
    })
    expect(signupSlugFromPath("/e/beach-cleanup-may")).toEqual({
      kind: "slug",
      slug: "beach-cleanup-may",
    })
  })

  it("treats the static-export placeholder and a bare visit as unaddressed", () => {
    expect(signupSlugFromPath("/e/_/")).toEqual({ kind: "none" })
    expect(signupSlugFromPath("/e/")).toEqual({ kind: "none" })
    expect(signupSlugFromPath("/cleanups/abc/")).toEqual({ kind: "none" })
    expect(signupSlugFromPath(null)).toEqual({ kind: "none" })
  })

  it("rejects anything the contract's PageSlugSchema would reject, without a round trip", () => {
    expect(signupSlugFromPath("/e/ab/")).toEqual({ kind: "invalid", raw: "ab" })
    expect(signupSlugFromPath("/e/-leading/")).toEqual({ kind: "invalid", raw: "-leading" })
    expect(signupSlugFromPath("/e/two--dashes/")).toEqual({ kind: "invalid", raw: "two--dashes" })
    expect(signupSlugFromPath(`/e/${"x".repeat(61)}/`)).toEqual({
      kind: "invalid",
      raw: "x".repeat(61),
    })
    expect(signupSlugFromPath("/e/%zz/")).toEqual({ kind: "invalid", raw: "%zz" })
  })

  it("lowercases a hand-typed slug", () => {
    expect(signupSlugFromPath("/e/Beach-Cleanup/")).toEqual({
      kind: "slug",
      slug: "beach-cleanup",
    })
  })

  it("builds a trailing-slash permalink", () => {
    expect(signupPath("beach-cleanup")).toBe("/e/beach-cleanup/")
  })
})

describe("accessCodeFromSearch", () => {
  it("reads a shared access code", () => {
    expect(accessCodeFromSearch("?code=VIP2026")).toBe("VIP2026")
    expect(accessCodeFromSearch("?code=")).toBe(null)
    expect(accessCodeFromSearch("")).toBe(null)
  })
})
