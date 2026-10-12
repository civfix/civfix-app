import { describe, expect, it } from "vitest"

import { overVideoLimits } from "@/lib/video-limits"

describe("overVideoLimits", () => {
  it("passes a 9 s 1080p clip and one exactly at the limits", () => {
    expect(overVideoLimits({ durationSec: 9, width: 1920, height: 1080 })).toBe(false)
    expect(overVideoLimits({ durationSec: 10, width: 1080, height: 1920 })).toBe(false)
  })

  it("rejects a clip longer than 10 s", () => {
    expect(overVideoLimits({ durationSec: 10.5, width: 1280, height: 720 })).toBe(true)
  })

  it("rejects a 4K clip in either orientation", () => {
    expect(overVideoLimits({ durationSec: 5, width: 3840, height: 2160 })).toBe(true)
    expect(overVideoLimits({ durationSec: 5, width: 2160, height: 3840 })).toBe(true)
  })

  it("lets through what the browser could not read", () => {
    expect(overVideoLimits({ durationSec: Number.POSITIVE_INFINITY, width: 1280, height: 720 })).toBe(false)
    expect(overVideoLimits({ durationSec: Number.NaN, width: 0, height: 0 })).toBe(false)
  })
})
