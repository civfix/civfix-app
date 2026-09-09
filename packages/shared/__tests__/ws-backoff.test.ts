import { describe, it, expect } from "vitest"
import { nextBackoffMs } from "../src/ws/backoff.js"

/**
 * nextBackoffMs is the pure reconnect-delay math shared by both WS clients. With an injected jitter we
 * can assert the exact ceiling per attempt (exponential, capped) and the full-jitter range.
 */

// jitter = 1 returns exactly the (capped) exponential ceiling for the attempt.
const ceiling = () => 1
// jitter = 0 returns exactly 0.
const floor = () => 0

describe("nextBackoffMs", () => {
  it("grows exponentially from the base until it hits the cap (ceiling jitter)", () => {
    expect(nextBackoffMs(0, { jitter: ceiling })).toBe(1000) // base
    expect(nextBackoffMs(1, { jitter: ceiling })).toBe(2000)
    expect(nextBackoffMs(2, { jitter: ceiling })).toBe(4000)
    expect(nextBackoffMs(3, { jitter: ceiling })).toBe(8000)
    // 16000 would exceed the 15000 cap -> clamped.
    expect(nextBackoffMs(4, { jitter: ceiling })).toBe(15000)
    expect(nextBackoffMs(10, { jitter: ceiling })).toBe(15000)
  })

  it("is monotonic non-decreasing in attempt and never exceeds the cap (ceiling jitter)", () => {
    let prev = -1
    for (let attempt = 0; attempt <= 20; attempt++) {
      const v = nextBackoffMs(attempt, { jitter: ceiling })
      expect(v).toBeGreaterThanOrEqual(prev)
      expect(v).toBeLessThanOrEqual(15000)
      prev = v
    }
  })

  it("returns 0 with floor jitter (full jitter lower bound)", () => {
    for (let attempt = 0; attempt <= 6; attempt++) {
      expect(nextBackoffMs(attempt, { jitter: floor })).toBe(0)
    }
  })

  it("keeps a real random result within [0, capped exponential] for each attempt", () => {
    for (let attempt = 0; attempt <= 8; attempt++) {
      const capped = Math.min(15000, 1000 * 2 ** attempt)
      for (let i = 0; i < 50; i++) {
        const v = nextBackoffMs(attempt)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(capped)
      }
    }
  })

  it("honors custom base and cap", () => {
    expect(nextBackoffMs(0, { baseMs: 500, capMs: 5000, jitter: ceiling })).toBe(500)
    expect(nextBackoffMs(1, { baseMs: 500, capMs: 5000, jitter: ceiling })).toBe(1000)
    expect(nextBackoffMs(20, { baseMs: 500, capMs: 5000, jitter: ceiling })).toBe(5000)
  })

  it("treats negative / non-finite attempts as attempt 0 (delay = base)", () => {
    expect(nextBackoffMs(-3, { jitter: ceiling })).toBe(1000)
    expect(nextBackoffMs(Number.NaN, { jitter: ceiling })).toBe(1000)
    expect(nextBackoffMs(Number.POSITIVE_INFINITY, { jitter: ceiling })).toBe(1000)
  })
})
