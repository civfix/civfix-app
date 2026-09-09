import { describe, it, expect } from "vitest"
import { EDIT_WINDOW_HOURS } from "@civfix/shared"
import { withinEditWindow } from "../relativeTime"

const NOW = new Date("2026-07-18T12:00:00.000Z")
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString()

describe("withinEditWindow", () => {
  it("is true just inside the window (47.9h ago)", () => {
    expect(withinEditWindow(hoursAgo(47.9), NOW)).toBe(true)
  })

  it("is false just past the window (48.1h ago)", () => {
    expect(withinEditWindow(hoursAgo(48.1), NOW)).toBe(false)
  })

  it("is true for a message sent right now", () => {
    expect(withinEditWindow(NOW.toISOString(), NOW)).toBe(true)
  })

  it("is false for invalid/garbage dates (defensive)", () => {
    expect(withinEditWindow("not-a-date", NOW)).toBe(false)
    expect(withinEditWindow("", NOW)).toBe(false)
  })

  it("tracks the shared EDIT_WINDOW_HOURS constant", () => {
    expect(withinEditWindow(hoursAgo(EDIT_WINDOW_HOURS - 0.1), NOW)).toBe(true)
    expect(withinEditWindow(hoursAgo(EDIT_WINDOW_HOURS + 0.1), NOW)).toBe(false)
  })
})
