import { describe, expect, it } from "vitest"
import type { CleanupDTO, EventInsights, EventPhase } from "@civfix/shared"
import {
  ARRIVAL_BUCKET_MINUTES,
  MAX_ARRIVAL_SPARK_BUCKETS,
  MESSAGE_CTA_WINDOW_MS,
  arrivalOffsetLabel,
  arrivalSparkPoints,
  attendanceRate,
  eventEnd,
  hostActionCards,
  hostHero,
  hostPanels,
  hostPrimaryCta,
  hostSecondaryCta,
  hostStatTiles,
  hostedEventFromCleanup,
  peakArrival,
  registrationTrendPoints,
  sourceSeats,
  spotsLeft,
  stillExpected,
  type HostSurfaceCapabilities,
  type HostSurfaceInput,
} from "../hostSurfaceModel"

const NOW = Date.parse("2026-09-11T18:00:00.000Z")
const HOUR = 3_600_000

const ALL: HostSurfaceCapabilities = {
  checkIn: true,
  broadcast: true,
  manageEvent: true,
  manageTickets: true,
  manageTeam: true,
  viewRoster: true,
  viewAnalytics: true,
  cancelEvent: true,
  requestResources: true,
}

const NONE: HostSurfaceCapabilities = {
  checkIn: false,
  broadcast: false,
  manageEvent: false,
  manageTickets: false,
  manageTeam: false,
  viewRoster: true,
  viewAnalytics: false,
  cancelEvent: false,
  requestResources: false,
}

function surface(over: Partial<HostSurfaceInput> = {}): HostSurfaceInput {
  return {
    phase: "upcoming",
    now: NOW,
    startsAt: NOW + 7 * 24 * HOUR,
    endsAt: null,
    registeredSeats: 0,
    hoursCredited: 0,
    scannerAvailable: false,
    completionArmed: false,
    can: ALL,
    ...over,
  }
}

function insights(over: Partial<EventInsights> = {}): EventInsights {
  return {
    generatedAt: new Date(NOW).toISOString(),
    phase: "upcoming",
    clock: {
      status: "upcoming",
      startsAt: new Date(NOW + HOUR).toISOString(),
      endsAt: null,
      completedAt: null,
      registrationClosesAt: null,
      timezone: "America/Los_Angeles",
    },
    seats: {
      registered: 38,
      capacity: 50,
      waitlisted: 4,
      cancelled: 2,
      checkedIn: 31,
      noShow: 5,
      unmarked: 2,
    },
    registrationTrend: [],
    byTicketType: [],
    bySource: [],
    broadcasts: [],
    arrivals: [],
    hours: { credited: 62.5, attendeesCredited: 25, attendeesCheckedIn: 31 },
    money: null,
    returning: null,
    ...over,
  }
}

describe("one primary CTA per phase", () => {
  it("offers share before the event, and swaps to a message inside the 48h window", () => {
    expect(hostPrimaryCta(surface())).toBe("share")
    expect(
      hostPrimaryCta(
        surface({ startsAt: NOW + MESSAGE_CTA_WINDOW_MS - HOUR, registeredSeats: 12 }),
      ),
    ).toBe("message")
  })

  it("keeps share when nobody has registered, because there is nobody to message", () => {
    expect(
      hostPrimaryCta(surface({ startsAt: NOW + HOUR, registeredSeats: 0 })),
    ).toBe("share")
  })

  it("keeps share when the viewer may not broadcast", () => {
    expect(
      hostPrimaryCta(
        surface({ startsAt: NOW + HOUR, registeredSeats: 12, can: { ...ALL, broadcast: false } }),
      ),
    ).toBe("share")
  })

  it("puts check-in first while live, and names the scanner when one exists", () => {
    expect(hostPrimaryCta(surface({ phase: "live", startsAt: NOW - HOUR }))).toBe("check_in")
    expect(
      hostPrimaryCta(surface({ phase: "live", startsAt: NOW - HOUR, scannerAvailable: true })),
    ).toBe("scan")
  })

  it("promotes completion only once the end time has passed and the server gate is armed", () => {
    const past = surface({ phase: "live", startsAt: NOW - 6 * HOUR, endsAt: NOW - HOUR })
    expect(hostPrimaryCta(past)).toBe("check_in")
    expect(hostPrimaryCta({ ...past, completionArmed: true })).toBe("complete")
  })

  it("falls back to the default duration when the event carries no end time", () => {
    const input = surface({ phase: "live", startsAt: NOW - 5 * HOUR, completionArmed: true })
    expect(eventEnd(input)).toBe(NOW - HOUR)
    expect(hostPrimaryCta(input)).toBe("complete")
  })

  it("asks for hours after the event, then for a duplicate once hours exist", () => {
    expect(hostPrimaryCta(surface({ phase: "ended" }))).toBe("log_hours")
    expect(hostPrimaryCta(surface({ phase: "ended", hoursCredited: 62.5 }))).toBe("duplicate")
    expect(
      hostPrimaryCta(surface({ phase: "ended", hoursCredited: 62.5, can: NONE })),
    ).toBeNull()
  })

  it("offers no primary at all on a cancelled event", () => {
    expect(hostPrimaryCta(surface({ phase: "cancelled" }))).toBeNull()
    expect(hostPrimaryCta(surface({ phase: "cancelled", can: NONE }))).toBeNull()
  })

  it("never repeats the primary in the secondary slot", () => {
    for (const phase of ["upcoming", "live", "ended", "cancelled"] as const) {
      for (const can of [ALL, NONE]) {
        const input = surface({ phase, can, startsAt: NOW + HOUR, registeredSeats: 9 })
        const primary = hostPrimaryCta(input)
        const secondary = hostSecondaryCta(input)
        expect(secondary === null || secondary !== primary, `${phase}`).toBe(true)
      }
    }
  })

  it("puts editing beside the share CTA and duplication beside a cancelled event", () => {
    expect(hostSecondaryCta(surface())).toBe("edit")
    expect(hostSecondaryCta(surface({ phase: "cancelled" }))).toBe("duplicate")
    expect(hostSecondaryCta(surface({ phase: "live", startsAt: NOW - HOUR }))).toBe("message")
  })
})

describe("panels per phase", () => {
  it("hides every panel but the hero on a cancelled event", () => {
    expect(hostPanels("cancelled")).toEqual({
      hero: true,
      tiles: false,
      signups: false,
      byTicketType: false,
      arrivals: false,
      messages: false,
    })
  })

  it("shows sign-ups before the event and arrivals from the moment it is live", () => {
    expect(hostPanels("upcoming").signups).toBe(true)
    expect(hostPanels("upcoming").arrivals).toBe(false)
    expect(hostPanels("live").arrivals).toBe(true)
    expect(hostPanels("live").signups).toBe(false)
    expect(hostPanels("ended").arrivals).toBe(true)
    expect(hostPanels("ended").messages).toBe(true)
  })
})

describe("the hero figure follows the phase", () => {
  it("counts registered seats against capacity before the event", () => {
    expect(hostHero(insights(), "upcoming")).toEqual({ key: "registered", value: 38, limit: 50 })
  })

  it("counts check-ins against registrations once live, and attendance once ended", () => {
    expect(hostHero(insights(), "live")).toEqual({ key: "checked_in", value: 31, limit: 38 })
    expect(hostHero(insights(), "ended")).toEqual({ key: "attended", value: 31, limit: 38 })
  })

  it("carries a null limit through as an uncapped event", () => {
    const uncapped = insights({ seats: { ...insights().seats, capacity: null } })
    expect(hostHero(uncapped, "upcoming").limit).toBeNull()
    expect(spotsLeft(uncapped)).toBeNull()
  })
})

describe("derived seat numbers", () => {
  it("never reports a negative remainder", () => {
    const over = insights({
      seats: { ...insights().seats, registered: 4, checkedIn: 9, noShow: 2, capacity: 2 },
    })
    expect(stillExpected(over)).toBe(0)
    expect(spotsLeft(over)).toBe(0)
  })

  it("reads the attendance rate as a fraction, and nothing when nobody registered", () => {
    expect(attendanceRate(insights())).toBeCloseTo(31 / 38)
    expect(attendanceRate(insights({ seats: { ...insights().seats, registered: 0 } }))).toBeNull()
  })

  it("reads walk-up seats out of the source breakdown", () => {
    const seats = insights({
      bySource: [
        { source: "self", seats: 30 },
        { source: "walkup", seats: 6 },
      ],
    })
    expect(sourceSeats(seats.bySource, "walkup")).toBe(6)
    expect(sourceSeats(seats.bySource, "transfer")).toBe(0)
  })
})

describe("stat tiles per phase", () => {
  it("drops spots-left on an uncapped event", () => {
    const keys = hostStatTiles(insights({ seats: { ...insights().seats, capacity: null } }), "upcoming").map(
      (tile) => tile.key,
    )
    expect(keys).toEqual(["waitlist", "cancelled", "messages"])
  })

  it("shows the live working set", () => {
    const tiles = hostStatTiles(insights({ bySource: [{ source: "walkup", seats: 6 }] }), "live")
    expect(tiles.map((tile) => tile.key)).toEqual(["expected", "walkups", "no_shows", "waitlist"])
    expect(tiles[0]?.value).toBe(2)
    expect(tiles[1]?.value).toBe(6)
  })

  it("hides the not-marked tile once the host has marked everyone", () => {
    const marked = insights({ seats: { ...insights().seats, unmarked: 0 } })
    expect(hostStatTiles(marked, "ended").map((tile) => tile.key)).not.toContain("not_marked")
    expect(hostStatTiles(insights(), "ended").map((tile) => tile.key)).toContain("not_marked")
  })

  it("adds money and returning only when the server sent them", () => {
    expect(hostStatTiles(insights(), "ended").map((tile) => tile.key)).not.toContain("donations")
    const rich = insights({
      money: {
        currency: "USD",
        donationCount: 18,
        grossMinor: 124000,
        netMinor: 115100,
        refundedMinor: 0,
        lastChargedAt: null,
      },
      returning: { seats: 9, ofRegistered: 38 },
    })
    const tiles = hostStatTiles(rich, "ended")
    expect(tiles.map((tile) => tile.key)).toContain("donations")
    expect(tiles.find((tile) => tile.key === "returning")).toEqual({
      key: "returning",
      value: 9,
      total: 38,
    })
  })

  it("renders nothing for a cancelled event", () => {
    expect(hostStatTiles(insights(), "cancelled")).toEqual([])
  })
})

describe("action cards", () => {
  const base = {
    can: ALL,
    unmarked: 0,
    scannerAvailable: false,
    hasOrganization: true,
    consoleReachable: true,
  }

  it("never renders an empty card", () => {
    for (const phase of ["upcoming", "live", "ended", "cancelled"] as const) {
      for (const can of [ALL, NONE]) {
        for (const card of hostActionCards({ ...base, phase, can })) {
          expect(card.rows.length, `${phase}/${card.key}`).toBeGreaterThan(0)
        }
      }
    }
  })

  it("keeps cancel in the danger card only, and only while the event can still be cancelled", () => {
    for (const phase of ["upcoming", "live", "ended", "cancelled"] as const) {
      for (const card of hostActionCards({ ...base, phase })) {
        if (card.rows.includes("cancel")) expect(card.key).toBe("danger")
        if (card.key === "danger") expect(card.rows).toEqual(["cancel"])
      }
    }
    const keys = (phase: EventPhase) => hostActionCards({ ...base, phase }).map((card) => card.key)
    expect(keys("upcoming")).toContain("danger")
    expect(keys("live")).toContain("danger")
    expect(keys("ended")).not.toContain("danger")
    expect(keys("cancelled")).not.toContain("danger")
    expect(keys("upcoming")).not.toContain("money")
  })

  it("gates cancel on the capability rather than on the phase alone", () => {
    const cards = hostActionCards({ ...base, phase: "upcoming", can: { ...ALL, cancelEvent: false } })
    expect(cards.map((card) => card.key)).not.toContain("danger")
  })

  it("offers the check-in row only while live, and names the scanner when one exists", () => {
    const rows = (over: Partial<typeof base> & { phase: EventPhase }) =>
      hostActionCards({ ...base, ...over }).flatMap((card) => card.rows)
    expect(rows({ phase: "upcoming" })).not.toContain("check_in")
    expect(rows({ phase: "live" })).toContain("check_in")
    expect(rows({ phase: "live", scannerAvailable: true })).toContain("scan")
  })

  it("offers no-show marking only after the event and only while seats are unmarked", () => {
    const rows = (phase: EventPhase, unmarked: number) =>
      hostActionCards({ ...base, phase, unmarked }).flatMap((card) => card.rows)
    expect(rows("ended", 0)).not.toContain("mark_no_shows")
    expect(rows("ended", 3)).toContain("mark_no_shows")
    expect(rows("live", 3)).not.toContain("mark_no_shows")
  })

  it("hides the resources row without an organization", () => {
    const rows = (over: Partial<typeof base>) =>
      hostActionCards({ ...base, phase: "upcoming", ...over }).flatMap((card) => card.rows)
    expect(rows({})).toContain("resources")
    expect(rows({ hasOrganization: false })).not.toContain("resources")
  })

  it("offers tickets on the web, where the console exists, and never on native", () => {
    const rows = (consoleReachable: boolean) =>
      hostActionCards({ ...base, phase: "upcoming", consoleReachable }).flatMap((card) => card.rows)
    expect(rows(true)).toContain("tickets")
    expect(rows(false)).not.toContain("tickets")
    for (const phase of ["live", "ended", "cancelled"] as const) {
      const anyPhase = hostActionCards({ ...base, phase }).flatMap((card) => card.rows)
      expect(anyPhase, phase).not.toContain("tickets")
    }
  })

  it("leaves a cancelled event with nothing but a duplicate path", () => {
    const rows = hostActionCards({ ...base, phase: "cancelled" }).flatMap((card) => card.rows)
    expect(rows).toEqual([])
  })
})

describe("chart inputs", () => {
  it("maps the wire trend straight onto spark points", () => {
    expect(
      registrationTrendPoints([
        { day: "2026-09-01", seats: 4 },
        { day: "2026-09-02", seats: 11 },
      ]),
    ).toEqual([
      { key: "2026-09-01", value: 4 },
      { key: "2026-09-02", value: 11 },
    ])
  })

  it("densifies the arrival buckets so an empty quarter hour reads as a gap, not a jump", () => {
    const points = arrivalSparkPoints([
      { offsetMin: 0, seats: 3 },
      { offsetMin: 30, seats: 7 },
    ])
    expect(points).toEqual([
      { key: "0", value: 3 },
      { key: "15", value: 0 },
      { key: "30", value: 7 },
    ])
  })

  it("snaps an off-grid offset onto the quarter-hour grid and merges collisions", () => {
    const points = arrivalSparkPoints([
      { offsetMin: 2, seats: 1 },
      { offsetMin: 4, seats: 2 },
    ])
    expect(points).toEqual([{ key: "0", value: 3 }])
  })

  it("keeps the tail when an event ran far longer than the chart can show", () => {
    const wide = Array.from({ length: 60 }, (_unused, index) => ({
      offsetMin: index * ARRIVAL_BUCKET_MINUTES,
      seats: index,
    }))
    const points = arrivalSparkPoints(wide)
    expect(points).toHaveLength(MAX_ARRIVAL_SPARK_BUCKETS)
    expect(points[points.length - 1]).toEqual({ key: String(59 * ARRIVAL_BUCKET_MINUTES), value: 59 })
  })

  it("returns nothing at all when the server withheld the arrivals", () => {
    expect(arrivalSparkPoints([])).toEqual([])
    expect(peakArrival([])).toBeNull()
    expect(peakArrival([{ offsetMin: 0, seats: 0 }])).toBeNull()
  })

  it("names the busiest bucket", () => {
    expect(
      peakArrival([
        { offsetMin: -15, seats: 2 },
        { offsetMin: 15, seats: 9 },
        { offsetMin: 30, seats: 4 },
      ]),
    ).toEqual({ offsetMin: 15, seats: 9 })
  })

  it("labels an offset relative to the start", () => {
    expect(arrivalOffsetLabel(0)).toBe("+0m")
    expect(arrivalOffsetLabel(45)).toBe("+45m")
    expect(arrivalOffsetLabel(-30)).toBe("-30m")
    expect(arrivalOffsetLabel(120)).toBe("+2h")
    expect(arrivalOffsetLabel(-135)).toBe("-2h 15m")
  })
})

describe("the duplicate sheet's event ref", () => {
  const cleanup = {
    id: "e-1",
    title: "River sweep",
    type: "site",
    eventKind: "cleanup",
    scheduledAt: new Date(NOW).toISOString(),
    status: "done",
    organizer: { id: "p-1", name: "Ann", handle: "ann", followers: 0, following: 0, isFollowing: false },
    going: 12,
    joined: true,
    bring: [],
    address: null,
    linkedReports: [],
    slots: [],
    visibility: "public",
    galleryUrls: [],
    ticketTypes: [],
    myCapabilities: [],
  } as unknown as CleanupDTO

  it("prefers the insight seats over the cleanup's cached counts", () => {
    const ref = hostedEventFromCleanup(cleanup, insights())
    expect(ref).toMatchObject({
      id: "e-1",
      startsAt: cleanup.scheduledAt,
      registeredCount: 38,
      checkedInCount: 31,
      waitlistCount: 4,
      capacity: 50,
    })
  })

  it("still produces a usable ref with no insights at all", () => {
    const ref = hostedEventFromCleanup(cleanup, null)
    expect(ref.registeredCount).toBe(0)
    expect(ref.capacity).toBeNull()
    expect(ref.referenceCode).toBeNull()
  })
})
