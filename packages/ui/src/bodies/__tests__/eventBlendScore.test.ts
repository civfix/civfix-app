import { describe, it, expect } from "vitest"
import { eventBlendScore } from "../eventBlendScore"

const NOW = new Date("2026-06-26T12:00:00.000Z")
const inHours = (h: number) => new Date(NOW.getTime() + h * 3600_000).toISOString()

describe("eventBlendScore", () => {
  it("ranks a much-closer event ahead of a slightly-sooner far one", () => {
    const near = eventBlendScore(2_000, inHours(48), NOW) // 2 km, in 2 days
    const far = eventBlendScore(40_000, inHours(24), NOW) // 40 km, in 1 day
    expect(near).toBeLessThan(far) // lower = higher rank
  })

  it("a nearby event next week can outrank a slightly-closer event months out", () => {
    const soonNearby = eventBlendScore(5_000, inHours(24 * 7), NOW) // 5 km, 1 week
    const closerButFar = eventBlendScore(3_000, inHours(24 * 120), NOW) // 3 km, 4 months
    expect(soonNearby).toBeLessThan(closerButFar)
  })

  it("degrades to soonest-first when distance is null (no location)", () => {
    const sooner = eventBlendScore(null, inHours(12), NOW)
    const later = eventBlendScore(null, inHours(96), NOW)
    expect(sooner).toBeLessThan(later)
  })

  it("is deterministic given an explicit now", () => {
    expect(eventBlendScore(1000, inHours(10), NOW)).toBe(eventBlendScore(1000, inHours(10), NOW))
  })
})
