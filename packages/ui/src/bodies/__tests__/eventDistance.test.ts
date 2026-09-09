import { describe, expect, it } from "vitest"
import { eventDistanceLabel } from "../eventDistance"
import { distanceLabel } from "../relativeTime"
import { METERS_PER_MILE } from "../reportHitRowModel"

describe("eventDistanceLabel", () => {
  it("reads its input as METRES - the unit CleanupDTO.dist actually carries", () => {
    expect(eventDistanceLabel(METERS_PER_MILE)).toBe("1.0 mi")
    expect(eventDistanceLabel(0.4 * METERS_PER_MILE)).toBe("0.4 mi")
    expect(eventDistanceLabel(26 * METERS_PER_MILE)).toBe("26 mi")
  })

  it("never prints the raw metres a miles formatter would have rendered", () => {
    const quarterMile = 0.25 * METERS_PER_MILE
    expect(distanceLabel(quarterMile)).toBe("402 mi")
    expect(eventDistanceLabel(quarterMile)).toBe("0.3 mi")
  })

  it("renders nothing when the distance is unknown", () => {
    expect(eventDistanceLabel(null)).toBe("")
    expect(eventDistanceLabel(undefined)).toBe("")
    expect(eventDistanceLabel(Number.NaN)).toBe("")
  })

  it("keeps zero as a real distance", () => {
    expect(eventDistanceLabel(0)).toBe("0.0 mi")
  })
})
