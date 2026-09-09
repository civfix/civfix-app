/**
 * The single geoid resolver behind every leaderboard surface. The load-bearing property is that
 * device location wins and works with NO signed-in user - the discovery leaderboard is auth-independent.
 */
import { describe, expect, it } from "vitest"
import { resolveDiscoveryGeoid } from "../leaderboardGeoid"

describe("resolveDiscoveryGeoid", () => {
  it("prefers the resolved jurisdiction, signed out (no myHours at all)", () => {
    expect(resolveDiscoveryGeoid({ resolved: { geoid: "0644000", name: "Los Angeles" } })).toEqual({
      geoid: "0644000",
      name: "Los Angeles",
      source: "location",
    })
  })

  it("prefers the resolved jurisdiction over the viewer's own hours", () => {
    expect(
      resolveDiscoveryGeoid({
        resolved: { geoid: "0644000", name: "Los Angeles" },
        myHours: { byJurisdiction: [{ geoid: "0666000", name: "San Francisco" }] },
      }),
    ).toMatchObject({ geoid: "0644000", source: "location" })
  })

  it("falls back to the first byJurisdiction entry when location gives nothing", () => {
    expect(
      resolveDiscoveryGeoid({
        resolved: null,
        myHours: { byJurisdiction: [{ geoid: "0666000" }, { geoid: "0644000" }] },
      }),
    ).toEqual({ geoid: "0666000", name: null, source: "my-hours" })
  })

  it("returns null when there is nothing to resolve", () => {
    expect(resolveDiscoveryGeoid({})).toBeNull()
    expect(resolveDiscoveryGeoid({ resolved: null, myHours: null })).toBeNull()
    expect(resolveDiscoveryGeoid({ resolved: null, myHours: { byJurisdiction: [] } })).toBeNull()
  })

  it("ignores an empty geoid rather than routing to a blank leaderboard", () => {
    expect(
      resolveDiscoveryGeoid({
        resolved: { geoid: "", name: "Nowhere" },
        myHours: { byJurisdiction: [{ geoid: "0644000" }] },
      }),
    ).toMatchObject({ geoid: "0644000", source: "my-hours" })
  })
})
