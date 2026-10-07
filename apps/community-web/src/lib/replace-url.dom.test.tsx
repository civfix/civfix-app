import { describe, expect, it } from "vitest"

import { replaceUrlInPlace } from "@/lib/replace-url"

describe("replaceUrlInPlace", () => {
  it("rewrites the current entry with no state object and adds no history entry", () => {
    window.history.replaceState({ __NA: true }, "", "/manage/org-invites/accept/?token=secret#t")
    const length = window.history.length
    replaceUrlInPlace("/manage/org-invites/accept/")
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      "/manage/org-invites/accept/",
    )
    expect(window.history.state).toBeNull()
    expect(window.history.length).toBe(length)
  })
})
