import { describe, expect, it } from "vitest"
import {
  LEADERBOARD_PREVIEW_LIMIT,
  LEADERBOARD_REQUEST_LIMIT,
  NEARBY_REPORTS_LIMIT,
  PRESSING_NEARBY_LIMIT,
  SUGGESTED_EVENTS_LIMIT,
  SUGGESTED_PEOPLE_LIMIT,
  assembleSearchSuggestions,
} from "../searchSuggestModel"

const NOW = new Date("2026-07-21T12:00:00Z")

/** An event `hoursOut` hours from NOW at the given coords (no server `dist`). */
function event(id: string, hoursOut: number, lat = 34.05, lng = -118.24, dist?: number | null) {
  return {
    id,
    scheduledAt: new Date(NOW.getTime() + hoursOut * 3_600_000).toISOString(),
    lat,
    lng,
    dist,
  }
}

const HERE = { lat: 34.05, lng: -118.24 }

function pins(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `r${i}` }))
}

function people(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i}` }))
}

function ranked(n: number) {
  return Array.from({ length: n }, (_, i) => ({ userId: `u${i}`, rank: i + 1 }))
}

describe("assembleSearchSuggestions", () => {
  it("returns empty sections for empty inputs", () => {
    const out = assembleSearchSuggestions({
      cleanups: [],
      pins: [],
      pressing: [],
      people: [],
      leaderboard: [],
      leaderboardGeoid: null,
      location: HERE,
      signedIn: true,
      now: NOW,
    })
    expect(out).toEqual({ people: [], events: [], reports: [], pressing: [], leaderboard: [] })
  })

  it("caps suggested people at the section limit", () => {
    const out = assembleSearchSuggestions({
      cleanups: [],
      pins: [],
      pressing: [],
      people: people(12),
      leaderboard: [],
      leaderboardGeoid: null,
      location: null,
      signedIn: true,
      now: NOW,
    })
    expect(out.people).toHaveLength(SUGGESTED_PEOPLE_LIMIT)
    expect(out.people[0]!.id).toBe("p0")
  })

  it("hides suggested people entirely when signed out", () => {
    const out = assembleSearchSuggestions({
      cleanups: [],
      pins: [],
      pressing: [],
      people: people(3),
      leaderboard: [],
      leaderboardGeoid: null,
      location: HERE,
      signedIn: false,
      now: NOW,
    })
    expect(out.people).toEqual([])
  })

  it("ranks events by the near+soon blend (a nearby soon event beats a far soon one)", () => {
    // "far" is ~80 km north (~10 distance units at 8 km/unit), so even though it is a touch sooner,
    // the nearby event must outrank it.
    const near = event("near", 48)
    const far = event("far", 24, 34.77, -118.24)
    const out = assembleSearchSuggestions({
      cleanups: [far, near],
      pins: [],
      pressing: [],
      people: [],
      leaderboard: [],
      leaderboardGeoid: null,
      location: HERE,
      signedIn: true,
      now: NOW,
    })
    expect(out.events.map((e) => e.id)).toEqual(["near", "far"])
  })

  it("prefers the server-computed dist over the haversine fallback", () => {
    // Same coords, but the server says "a" is 40 km out while "b" is adjacent: b must win.
    const a = event("a", 24, HERE.lat, HERE.lng, 40_000)
    const b = event("b", 24, HERE.lat, HERE.lng, 100)
    const out = assembleSearchSuggestions({
      cleanups: [a, b],
      pins: [],
      pressing: [],
      people: [],
      leaderboard: [],
      leaderboardGeoid: null,
      location: HERE,
      signedIn: true,
      now: NOW,
    })
    expect(out.events.map((e) => e.id)).toEqual(["b", "a"])
  })

  it("degrades to soonest-first without a location", () => {
    const out = assembleSearchSuggestions({
      cleanups: [event("later", 72, 34.77, -118.24), event("sooner", 6)],
      pins: [],
      pressing: [],
      people: [],
      leaderboard: [],
      leaderboardGeoid: null,
      location: null,
      signedIn: false,
      now: NOW,
    })
    expect(out.events.map((e) => e.id)).toEqual(["sooner", "later"])
  })

  it("caps events at the section limit", () => {
    const cleanups = Array.from({ length: 9 }, (_, i) => event(`e${i}`, i + 1))
    const out = assembleSearchSuggestions({
      cleanups,
      pins: [],
      pressing: [],
      people: [],
      leaderboard: [],
      leaderboardGeoid: null,
      location: HERE,
      signedIn: true,
      now: NOW,
    })
    expect(out.events).toHaveLength(SUGGESTED_EVENTS_LIMIT)
    // Soonest-first (all equidistant), so the first four by lead time.
    expect(out.events.map((e) => e.id)).toEqual(["e0", "e1", "e2", "e3"])
  })

  it("caps nearby reports at the section limit and keeps their order", () => {
    const out = assembleSearchSuggestions({
      cleanups: [],
      pins: pins(7),
      pressing: [],
      people: [],
      leaderboard: [],
      leaderboardGeoid: null,
      location: HERE,
      signedIn: false,
      now: NOW,
    })
    expect(out.reports).toHaveLength(NEARBY_REPORTS_LIMIT)
    expect(out.reports[0]!.id).toBe("r0")
  })

  it("shows no nearby reports without a location (proximity is meaningless)", () => {
    const out = assembleSearchSuggestions({
      cleanups: [],
      pins: pins(3),
      pressing: [],
      people: [],
      leaderboard: [],
      leaderboardGeoid: null,
      location: null,
      signedIn: true,
      now: NOW,
    })
    expect(out.reports).toEqual([])
  })

  /**
   * The leaderboard is GEOID-gated, not auth- or location-gated: the one gate in this file that is
   * neither of the other two. A signed-out visitor whose device resolved a jurisdiction sees the board;
   * a signed-in viewer whose jurisdiction could not be resolved does not, no matter what rows the query
   * happens to be holding.
   */
  it("shows the leaderboard to a SIGNED-OUT viewer once a geoid resolves", () => {
    const out = assembleSearchSuggestions({
      cleanups: [],
      pins: [],
      pressing: [],
      people: [],
      leaderboard: ranked(3),
      leaderboardGeoid: "0644000",
      location: null,
      signedIn: false,
      now: NOW,
    })
    expect(out.leaderboard).toHaveLength(3)
    expect(out.leaderboard.map((e) => e.userId)).toEqual(["u0", "u1", "u2"])
    // ...and it did not smuggle the auth gate in from the people section.
    expect(out.people).toEqual([])
  })

  it("hides the leaderboard entirely without a geoid, even when entries are supplied", () => {
    const out = assembleSearchSuggestions({
      cleanups: [],
      pins: [],
      pressing: [],
      people: [],
      leaderboard: ranked(3),
      leaderboardGeoid: null,
      location: HERE,
      signedIn: true,
      now: NOW,
    })
    expect(out.leaderboard).toEqual([])
  })

  /**
   * EMPTINESS IS A RENDER DECISION, NOT A MODEL ONE. A resolved geoid whose board has no rows yet is a
   * perfectly valid, RENDERABLE state (SearchBody shows the section with the full page's "be the first"
   * copy), so the model must report it as "a board that is empty", indistinguishable in shape from any
   * other board. It must NOT start signalling "no board here" (that is what a null geoid means, the case
   * directly below), or the render gate loses the only thing that tells the two apart.
   */
  it("keeps a resolved geoid with zero entries as a valid, empty board", () => {
    const out = assembleSearchSuggestions({
      cleanups: [],
      pins: [],
      pressing: [],
      people: [],
      leaderboard: [],
      leaderboardGeoid: "0670000",
      location: HERE,
      signedIn: true,
      now: NOW,
    })
    expect(out.leaderboard).toEqual([])
  })

  it("caps the leaderboard preview at the preview limit, keeping server rank order", () => {
    const out = assembleSearchSuggestions({
      cleanups: [],
      pins: [],
      pressing: [],
      people: [],
      leaderboard: ranked(50),
      leaderboardGeoid: "0644000",
      location: HERE,
      signedIn: true,
      now: NOW,
    })
    expect(out.leaderboard).toHaveLength(LEADERBOARD_PREVIEW_LIMIT)
    expect(out.leaderboard.map((e) => e.rank)).toEqual([1, 2, 3])
  })

  it("still slices to three when the request asked for the whole extras-threshold page", () => {
    // Discovery REQUESTS 25 rows (the server only computes viewerRank/viewerHours at limit >= 25)
    // and renders three. That split only works because the slice lives here, so this asserts the model
    // handles a full request page, not just a page that happened to arrive pre-trimmed.
    const out = assembleSearchSuggestions({
      cleanups: [],
      pins: [],
      pressing: [],
      people: [],
      leaderboard: ranked(LEADERBOARD_REQUEST_LIMIT),
      leaderboardGeoid: "0644000",
      location: HERE,
      signedIn: true,
      now: NOW,
    })
    expect(LEADERBOARD_REQUEST_LIMIT).toBeGreaterThanOrEqual(25)
    expect(out.leaderboard).toHaveLength(LEADERBOARD_PREVIEW_LIMIT)
  })
})

describe("assembleSearchSuggestions: Most pressing nearby", () => {
  /** Pins as the pressing endpoint returns them: ranked server-side, carrying their Me too counts. */
  function pressingPins(counts: readonly number[]) {
    return counts.map((confirmCount, i) => ({ id: `p${i + 1}`, confirmCount }))
  }

  function assemble({
    pressing,
    location = HERE,
    signedIn = true,
  }: {
    pressing: readonly { id: string; confirmCount: number }[]
    location?: { lat: number; lng: number } | null
    signedIn?: boolean
  }) {
    return assembleSearchSuggestions({
      cleanups: [event("e1", 24), event("e2", 48)],
      pins: [
        { id: "r1", confirmCount: 0 },
        { id: "r2", confirmCount: 5 },
      ],
      pressing,
      people: people(2),
      leaderboard: ranked(4),
      leaderboardGeoid: "0644000",
      location,
      signedIn,
      now: NOW,
    })
  }

  it("T7: shows no pressing reports without a location", () => {
    expect(assemble({ pressing: pressingPins([3, 2, 1]), location: null }).pressing).toEqual([])
  })

  it("T8: caps the section at ten, in the order the API returned", () => {
    const twelve = pressingPins([12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1])
    const out = assemble({ pressing: twelve })
    expect(PRESSING_NEARBY_LIMIT).toBe(10)
    expect(out.pressing.map((p) => p.id)).toEqual([
      "p1",
      "p2",
      "p3",
      "p4",
      "p5",
      "p6",
      "p7",
      "p8",
      "p9",
      "p10",
    ])
  })

  it("T9: never re-sorts by count", () => {
    const out = assemble({ pressing: pressingPins([1, 3]) })
    expect(out.pressing.map((p) => p.confirmCount)).toEqual([1, 3])
  })

  it("T10: an empty ranking (loading, error, none) empties only this section", () => {
    const empty = assemble({ pressing: [] })
    const full = assemble({ pressing: pressingPins([3, 2, 1]) })
    expect(empty.pressing).toEqual([])
    expect(empty.events).toEqual(full.events)
    expect(empty.people).toEqual(full.people)
    expect(empty.reports).toEqual(full.reports)
    expect(empty.leaderboard).toEqual(full.leaderboard)
  })

  it("T11: guests see it too", () => {
    const two = pressingPins([2, 1])
    expect(assemble({ pressing: two, signedIn: false }).pressing).toEqual(two)
  })
})
