import { describe, expect, it } from "vitest"

import { daysAgo, galleryChatHistory, hoursAgo, isoFromNow, makeCannedApi } from "./fixtures"

describe("makeCannedApi", () => {
  const canned = { getReport: async () => "canned" }
  const api = makeCannedApi(canned, (name) => `fallback:${name}`) as unknown as Record<string, unknown>

  it("answers a stubbed endpoint from the canned table", () => {
    expect(api.getReport).toBe(canned.getReport)
  })

  it("routes an unstubbed name, including an inherited Object member, to the fallback", () => {
    expect(api.listThreads).toBe("fallback:listThreads")
    expect(api.constructor).toBe("fallback:constructor")
  })

  it("is never a thenable, so awaiting the client does not hang on it", async () => {
    expect(api.then).toBeUndefined()
    await expect(Promise.resolve(api)).resolves.toBe(api)
  })
})

describe("gallery time helpers", () => {
  it("offset from now by whole minutes, hours and days", () => {
    const before = Date.now()
    const inTwoDays = Date.parse(isoFromNow(2 * 86_400_000))
    const threeHoursAgo = Date.parse(hoursAgo(3))
    const oneDayAgo = Date.parse(daysAgo(1))
    const after = Date.now()
    expect(inTwoDays).toBeGreaterThanOrEqual(before + 2 * 86_400_000)
    expect(inTwoDays).toBeLessThanOrEqual(after + 2 * 86_400_000)
    expect(threeHoursAgo).toBeGreaterThanOrEqual(before - 3 * 3_600_000)
    expect(threeHoursAgo).toBeLessThanOrEqual(after - 3 * 3_600_000)
    expect(oneDayAgo).toBeLessThanOrEqual(after - 86_400_000)
  })
})

describe("galleryChatHistory", () => {
  it("files the same four seed messages under whichever room asked", () => {
    const history = galleryChatHistory("e1")
    expect(history.nextCursor).toBeNull()
    expect(history.items.map((m) => [m.id, m.from?.id, m.cleanupId])).toEqual([
      ["m1", "p-ann", "e1"],
      ["m2", "p-lee", "e1"],
      ["m3", "me", "e1"],
      ["m4", "p-ann", "e1"],
    ])
    expect(galleryChatHistory("dm-ann").items.every((m) => m.cleanupId === "dm-ann")).toBe(true)
  })
})
