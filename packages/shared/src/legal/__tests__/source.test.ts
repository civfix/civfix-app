import { describe, expect, it } from "vitest"
import { SOURCE_REPO_URL, sourceLink } from "../source.js"

describe("sourceLink", () => {
  it("links the exact deployed tree for a commit sha, lowercased", () => {
    expect(sourceLink("abc1234")).toEqual({ commit: "abc1234", url: `${SOURCE_REPO_URL}/tree/abc1234` })
    expect(sourceLink("ABCDEF1234567890abcdef1234567890abcdef12")).toEqual({
      commit: "abcdef1234567890abcdef1234567890abcdef12",
      url: `${SOURCE_REPO_URL}/tree/abcdef1234567890abcdef1234567890abcdef12`,
    })
  })

  it("falls back to the repository root and refuses non-sha values", () => {
    expect(sourceLink(undefined)).toEqual({ commit: "", url: SOURCE_REPO_URL })
    expect(sourceLink(null)).toEqual({ commit: "", url: SOURCE_REPO_URL })
    for (const bad of ["", "main", "abc", "../x", "../../evil", "abc1234; rm -rf", "g".repeat(40)]) {
      expect(sourceLink(bad), bad).toEqual({ commit: "", url: SOURCE_REPO_URL })
    }
  })

  it("names the civfix-app repository", () => {
    expect(SOURCE_REPO_URL).toBe("https://github.com/civfix/civfix-app")
  })
})
