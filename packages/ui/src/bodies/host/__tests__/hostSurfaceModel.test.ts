import { describe, expect, it } from "vitest"
import type { CleanupDTO, EventInsights } from "@civfix/shared"
import { hostStage, type EventWindowLike, type HostStage } from "@civfix/shared/host"
import {
  ARRIVAL_BUCKET_MINUTES,
  HOST_ROW_ICONS,
  MAX_ARRIVAL_SPARK_BUCKETS,
  MESSAGE_CTA_WINDOW_MS,
  arrivalOffsetLabel,
  arrivalSparkPoints,
  attendanceRate,
  hostActionCards,
  hostHero,
  hostPanels,
  hostPrimaryCta,
  hostSecondaryCta,
  hostStatTiles,
  hostedEventFromCleanup,
  hoursHintHasDenominator,
  peakArrival,
  registrationTrendPoints,
  sourceSeats,
  spotsLeft,
  stillExpected,
  type HostRowKey,
  type HostSurfaceCapabilities,
  type HostSurfaceInput,
} from "../hostSurfaceModel"

const NOW = Date.parse("2026-09-11T18:00:00.000Z")
const HOUR = 3_600_000

const iso = (at: number): string => new Date(at).toISOString()

/**
 * Every stage in these tests is DERIVED from a real window through the shared clock, never hand-injected:
 * a stage the clock cannot produce is a state the app can never be in, and pinning the CTA table to one
 * is how the old suite ended up asserting on a phase/status pair that could not co-exist.
 */
function stageOf(startsAt: number, endsAt: number, status: EventWindowLike["status"] = "upcoming"): HostStage {
  return hostStage({ status, scheduledAt: iso(startsAt), endsAt: iso(endsAt) }, NOW)
}

const STAGES: Readonly<Record<HostStage, HostStage>> = {
  upcoming: stageOf(NOW + 7 * 24 * HOUR, NOW + 7 * 24 * HOUR + 4 * HOUR),
  soon: stageOf(NOW + HOUR, NOW + 5 * HOUR),
  underway: stageOf(NOW - HOUR, NOW + 3 * HOUR),
  wrapping_up: stageOf(NOW - 5 * HOUR, NOW - HOUR),
  past: stageOf(NOW - 9 * HOUR, NOW - 5 * HOUR),
  cancelled: stageOf(NOW - HOUR, NOW + 3 * HOUR, "cancelled"),
}

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
  logHours: true,
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
  logHours: false,
}

function surface(over: Partial<HostSurfaceInput> = {}): HostSurfaceInput {
  return {
    stage: STAGES.upcoming,
    now: NOW,
    startsAt: NOW + 7 * 24 * HOUR,
    registeredSeats: 0,
    hoursCredited: 0,
    scannerAvailable: false,
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
    topVolunteers: [],
    returning: null,
    ...over,
  }
}

describe("the stages the shared clock can actually produce", () => {
  it("names each of the six windows", () => {
    expect(STAGES).toEqual({
      upcoming: "upcoming",
      soon: "soon",
      underway: "underway",
      wrapping_up: "wrapping_up",
      past: "past",
      cancelled: "cancelled",
    })
  })
})

describe("one primary CTA per stage", () => {
  it("offers share before the event, and swaps to a message inside the 48h window", () => {
    expect(hostPrimaryCta(surface())).toBe("share")
    expect(
      hostPrimaryCta(
        surface({ startsAt: NOW + MESSAGE_CTA_WINDOW_MS - HOUR, registeredSeats: 12 }),
      ),
    ).toBe("message")
  })

  it("keeps share when nobody has registered, because there is nobody to message", () => {
    expect(hostPrimaryCta(surface({ startsAt: NOW + 3 * HOUR, registeredSeats: 0 }))).toBe("share")
  })

  it("keeps share when the viewer may not broadcast", () => {
    expect(
      hostPrimaryCta(
        surface({ startsAt: NOW + 3 * HOUR, registeredSeats: 12, can: { ...ALL, broadcast: false } }),
      ),
    ).toBe("share")
  })

  it("puts check-in first from the lead window on, and names the scanner when one exists", () => {
    for (const stage of [STAGES.soon, STAGES.underway] as const) {
      expect(hostPrimaryCta(surface({ stage })), stage).toBe("check_in")
      expect(hostPrimaryCta(surface({ stage, scannerAvailable: true })), stage).toBe("scan")
    }
  })

  it("falls back to a message, then a share, for a host who cannot check anyone in", () => {
    const stage = STAGES.underway
    expect(hostPrimaryCta(surface({ stage, can: { ...ALL, checkIn: false } }))).toBe("message")
    expect(
      hostPrimaryCta(surface({ stage, can: { ...ALL, checkIn: false, broadcast: false } })),
    ).toBe("share")
  })

  it("asks for hours from the moment the event ends, not from a host marking it done", () => {
    expect(hostPrimaryCta(surface({ stage: STAGES.wrapping_up }))).toBe("log_hours")
    expect(hostPrimaryCta(surface({ stage: STAGES.past }))).toBe("log_hours")
  })

  it("keeps check-in reachable in the wrap-up tail once the hours are in", () => {
    const input = surface({ stage: STAGES.wrapping_up, hoursCredited: 62.5 })
    expect(hostPrimaryCta(input)).toBe("check_in")
    expect(hostPrimaryCta({ ...input, can: { ...ALL, checkIn: false } })).toBe("share")
  })

  it("offers a duplicate once the hours exist, and nothing to a viewer with no rights", () => {
    expect(hostPrimaryCta(surface({ stage: STAGES.past, hoursCredited: 62.5 }))).toBe("duplicate")
    expect(
      hostPrimaryCta(surface({ stage: STAGES.past, hoursCredited: 62.5, can: NONE })),
    ).toBeNull()
  })

  it("never offers Log hours to a viewer without manage_event - the server would 403 it", () => {
    const staff: HostSurfaceCapabilities = { ...ALL, logHours: false, manageEvent: false }
    for (const stage of [STAGES.wrapping_up, STAGES.past] as const) {
      expect(hostPrimaryCta(surface({ stage, can: staff })), stage).not.toBe("log_hours")
      expect(hostSecondaryCta(surface({ stage, can: staff })), stage).not.toBe("log_hours")
    }
  })

  it("offers no primary at all on a cancelled event", () => {
    expect(hostPrimaryCta(surface({ stage: STAGES.cancelled }))).toBeNull()
    expect(hostPrimaryCta(surface({ stage: STAGES.cancelled, can: NONE }))).toBeNull()
  })

  it("never repeats the primary in the secondary slot", () => {
    for (const stage of Object.values(STAGES)) {
      for (const can of [ALL, NONE]) {
        for (const hoursCredited of [0, 62.5]) {
          const input = surface({ stage, can, hoursCredited, startsAt: NOW + HOUR, registeredSeats: 9 })
          const primary = hostPrimaryCta(input)
          const secondary = hostSecondaryCta(input)
          expect(secondary === null || secondary !== primary, `${stage}`).toBe(true)
        }
      }
    }
  })

  it("puts editing beside the share CTA and duplication beside a cancelled event", () => {
    expect(hostSecondaryCta(surface())).toBe("edit")
    expect(hostSecondaryCta(surface({ stage: STAGES.cancelled }))).toBe("duplicate")
    expect(hostSecondaryCta(surface({ stage: STAGES.underway }))).toBe("message")
  })

  it("lets a past host correct hours that are already logged", () => {
    const input = surface({ stage: STAGES.past, hoursCredited: 62.5, can: { ...ALL, broadcast: false } })
    expect(hostPrimaryCta(input)).toBe("duplicate")
    expect(hostSecondaryCta(input)).toBe("log_hours")
  })
})

describe("panels per phase", () => {
  it("hides every panel but the hero on a cancelled event", () => {
    expect(hostPanels("cancelled")).toEqual({
      hero: true,
      tiles: false,
      shifts: false,
      topVolunteers: false,
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

  it("names the top volunteers only once the event is over and the hours are in", () => {
    expect(hostPanels("ended").topVolunteers).toBe(true)
    expect(hostPanels("upcoming").topVolunteers).toBe(false)
    expect(hostPanels("live").topVolunteers).toBe(false)
    expect(hostPanels("cancelled").topVolunteers).toBe(false)
  })

  it("offers the shift board while the shifts can still be staffed, and never after", () => {
    expect(hostPanels("upcoming").shifts).toBe(true)
    expect(hostPanels("live").shifts).toBe(true)
    expect(hostPanels("ended").shifts).toBe(false)
    expect(hostPanels("cancelled").shifts).toBe(false)
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

  it("adds returning only when the server sent it", () => {
    expect(hostStatTiles(insights(), "ended").map((tile) => tile.key)).not.toContain("returning")
    const rich = insights({ returning: { seats: 9, ofRegistered: 38 } })
    const tiles = hostStatTiles(rich, "ended")
    expect(tiles.find((tile) => tile.key === "returning")).toEqual({
      key: "returning",
      value: 9,
      total: 38,
    })
  })

  it("renders nothing for a cancelled event", () => {
    expect(hostStatTiles(insights(), "cancelled")).toEqual([])
  })

  it("keeps the hours denominator only while it is one the credited count sits inside", () => {
    expect(hoursHintHasDenominator(25, 31)).toBe(true)
    expect(hoursHintHasDenominator(31, 31)).toBe(true)
  })

  it("drops the denominator when more people were credited than ever checked in", () => {
    expect(hoursHintHasDenominator(24, 16)).toBe(false)
    expect(hoursHintHasDenominator(3, 0)).toBe(false)
    expect(hoursHintHasDenominator(0, 0)).toBe(false)
  })
})

describe("action cards", () => {
  const base = {
    can: ALL,
    unmarked: 0,
    scannerAvailable: false,
    hasOrganization: true,
    consoleReachable: true,
    isCleanup: false,
    linkedReportCount: 0,
  }

  const rowsFor = (over: Partial<typeof base> & { stage: HostStage }) =>
    hostActionCards({ ...base, ...over }).flatMap((card) => card.rows)

  it("never renders an empty card", () => {
    for (const stage of Object.values(STAGES)) {
      for (const can of [ALL, NONE]) {
        for (const card of hostActionCards({ ...base, stage, can })) {
          expect(card.rows.length, `${stage}/${card.key}`).toBeGreaterThan(0)
        }
      }
    }
  })

  it("keeps cancel in the danger card only, and only while the event can still be cancelled", () => {
    for (const stage of Object.values(STAGES)) {
      for (const card of hostActionCards({ ...base, stage })) {
        if (card.rows.includes("cancel")) expect(card.key).toBe("danger")
        if (card.key === "danger") expect(card.rows).toEqual(["cancel"])
      }
    }
    const keys = (stage: HostStage) => hostActionCards({ ...base, stage }).map((card) => card.key)
    expect(keys(STAGES.upcoming)).toContain("danger")
    expect(keys(STAGES.soon)).toContain("danger")
    expect(keys(STAGES.underway)).toContain("danger")
    expect(keys(STAGES.wrapping_up)).not.toContain("danger")
    expect(keys(STAGES.past)).not.toContain("danger")
    expect(keys(STAGES.cancelled)).not.toContain("danger")
  })

  it("gates cancel on the capability rather than on the stage alone", () => {
    const cards = hostActionCards({ ...base, stage: STAGES.upcoming, can: { ...ALL, cancelEvent: false } })
    expect(cards.map((card) => card.key)).not.toContain("danger")
  })

  it("offers the check-in row across the whole run window, and names the scanner when one exists", () => {
    expect(rowsFor({ stage: STAGES.upcoming })).not.toContain("check_in")
    for (const stage of [STAGES.soon, STAGES.underway, STAGES.wrapping_up] as const) {
      expect(rowsFor({ stage }), stage).toContain("check_in")
    }
    expect(rowsFor({ stage: STAGES.soon, scannerAvailable: true })).toContain("scan")
    expect(rowsFor({ stage: STAGES.past })).not.toContain("check_in")
  })

  it("offers Log hours from the end of the event on, gated on manage_event", () => {
    expect(rowsFor({ stage: STAGES.underway })).not.toContain("log_hours")
    expect(rowsFor({ stage: STAGES.wrapping_up })).toContain("log_hours")
    expect(rowsFor({ stage: STAGES.past })).toContain("log_hours")
    expect(rowsFor({ stage: STAGES.past, can: { ...ALL, logHours: false } })).not.toContain("log_hours")
  })

  it("offers no-show marking only after the event and only while seats are unmarked", () => {
    expect(rowsFor({ stage: STAGES.past, unmarked: 0 })).not.toContain("mark_no_shows")
    expect(rowsFor({ stage: STAGES.past, unmarked: 3 })).toContain("mark_no_shows")
    expect(rowsFor({ stage: STAGES.wrapping_up, unmarked: 3 })).toContain("mark_no_shows")
    expect(rowsFor({ stage: STAGES.underway, unmarked: 3 })).not.toContain("mark_no_shows")
  })

  it("keeps Edit reachable until the event ends, and never after - the server freezes it", () => {
    for (const stage of [STAGES.upcoming, STAGES.soon, STAGES.underway] as const) {
      expect(rowsFor({ stage }), stage).toContain("edit")
    }
    for (const stage of [STAGES.wrapping_up, STAGES.past, STAGES.cancelled] as const) {
      expect(rowsFor({ stage }), stage).not.toContain("edit")
    }
  })

  it("hides the resources row without an organization", () => {
    expect(rowsFor({ stage: STAGES.upcoming })).toContain("resources")
    expect(rowsFor({ stage: STAGES.upcoming, hasOrganization: false })).not.toContain("resources")
  })

  it("offers tickets on the web, where the console exists, and never on native", () => {
    expect(rowsFor({ stage: STAGES.upcoming, consoleReachable: true })).toContain("tickets")
    expect(rowsFor({ stage: STAGES.upcoming, consoleReachable: false })).not.toContain("tickets")
    for (const stage of [STAGES.underway, STAGES.wrapping_up, STAGES.past, STAGES.cancelled] as const) {
      expect(rowsFor({ stage }), stage).not.toContain("tickets")
    }
  })

  it("leaves a cancelled event with nothing but a duplicate path", () => {
    expect(rowsFor({ stage: STAGES.cancelled })).toEqual(["duplicate"])
  })

  it("offers Linked reports right after Edit while a cleanup can still be changed", () => {
    for (const stage of [STAGES.upcoming, STAGES.soon, STAGES.underway] as const) {
      const rows = rowsFor({ stage, isCleanup: true, linkedReportCount: 0 })
      expect(rows, stage).toContain("linked_reports")
      expect(rows.indexOf("linked_reports"), stage).toBe(rows.indexOf("edit") + 1)
    }
    const configure = hostActionCards({
      ...base,
      stage: STAGES.upcoming,
      isCleanup: true,
      linkedReportCount: 0,
    }).find((card) => card.key === "configure")
    expect(configure?.rows).toContain("linked_reports")
  })

  it("keeps the row off a gathering and off a host without manage_event", () => {
    expect(rowsFor({ stage: STAGES.upcoming, isCleanup: false, linkedReportCount: 3 })).not.toContain(
      "linked_reports",
    )
    expect(
      rowsFor({
        stage: STAGES.upcoming,
        isCleanup: true,
        linkedReportCount: 3,
        can: { ...ALL, manageEvent: false },
      }),
    ).not.toContain("linked_reports")
  })

  it("shows an ended or cancelled cleanup the row only when there is something to show", () => {
    for (const stage of [STAGES.wrapping_up, STAGES.past, STAGES.cancelled] as const) {
      expect(rowsFor({ stage, isCleanup: true, linkedReportCount: 0 }), stage).not.toContain(
        "linked_reports",
      )
      expect(rowsFor({ stage, isCleanup: true, linkedReportCount: 2 }), stage).toContain(
        "linked_reports",
      )
    }
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

describe("every host row carries an icon of its own", () => {
  it("gives the linked-reports row the map pin", () => {
    expect(HOST_ROW_ICONS.linked_reports).toBe("MapPin")
  })

  it("names an icon for every row the action cards can emit, in any stage", () => {
    const base = {
      unmarked: 2,
      scannerAvailable: true,
      hasOrganization: true,
      consoleReachable: true,
      isCleanup: true,
      linkedReportCount: 2,
    }
    const rows = new Set<HostRowKey>()
    for (const stage of Object.values(STAGES)) {
      for (const can of [ALL, NONE]) {
        for (const card of hostActionCards({ ...base, stage, can })) {
          for (const row of card.rows) rows.add(row)
        }
      }
    }
    expect(rows.size).toBeGreaterThan(0)
    for (const row of rows) expect(HOST_ROW_ICONS[row], row).toBeTruthy()
  })
})
