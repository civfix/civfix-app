import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { checkInRingA11y } from "../analyticsModel"

const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
const t = (key: string, options: Record<string, unknown> = {}) => `${key}|${JSON.stringify(options)}`

describe("the check-in ring's spoken label", () => {
  it("carries the rate, since the accessible ring hides the percentage drawn inside it", () => {
    expect(checkInRingA11y(t, 42)).toBe('card.checkins_ring_a11y|{"rate":42}')
    expect(checkInRingA11y(t, 0)).toBe('card.checkins_ring_a11y|{"rate":0}')
  })

  it("says the rate is unavailable instead of 0% when it is unknown or suppressed", () => {
    expect(checkInRingA11y(t, null)).toBe("card.checkins_ring_unknown_a11y|{}")
  })

  it.each([
    ["analytics/EventDaySection.tsx", "accessibilityLabel={checkInRingA11y(t, rate)}"],
    ["dashboard/AnalyticsCarouselCard.tsx", "ringA11y={checkInRingA11y(t, rate)}"],
  ])("%s labels its ring through the shared wording", (file, wiring) => {
    const src = code(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"))
    expect(src).toContain(wiring)
    expect(src).not.toContain("rate: rate ?? 0")
  })
})
