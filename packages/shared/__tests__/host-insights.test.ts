import { describe, it, expect } from "vitest"
import {
  CleanupMemberRoleSchema,
  OrganizationMemberRoleSchema,
} from "../src/schemas/common.js"
import {
  ArrivalOffsetBucketSchema,
  EventInsightsSchema,
  EventPhaseSchema,
  GetEventInsightsRequestSchema,
  GetEventInsightsResponseSchema,
  InsightsBroadcastSchema,
  InsightsTicketTypeSchema,
  MAX_INSIGHTS_ARRIVAL_BUCKETS,
  MAX_INSIGHTS_BROADCASTS,
  MAX_INSIGHTS_TICKET_TYPES,
  MAX_INSIGHTS_TREND_DAYS,
  SeatPointSchema,
} from "../src/schemas/host/insights.js"
import {
  DEFAULT_DURATION_MS,
  LIVE_LEAD_MS,
  LIVE_TAIL_MS,
  can,
  eventPhase,
  type EventPhaseClock,
  type HostStanding,
} from "../src/host/index.js"
import { endpoints } from "../src/client/endpoints.js"


const UUID = "123e4567-e89b-12d3-a456-426614174000"
const TICKET_UUID = "223e4567-e89b-12d3-a456-426614174000"
const BROADCAST_UUID = "323e4567-e89b-12d3-a456-426614174000"

const START = Date.parse("2026-09-12T17:00:00.000Z")

function minimalInsights(): unknown {
  return {
    generatedAt: "2026-09-12T16:00:00.000Z",
    phase: "upcoming",
    clock: {
      status: "upcoming",
      startsAt: "2026-09-12T17:00:00.000Z",
      endsAt: null,
      completedAt: null,
      registrationClosesAt: null,
      timezone: "America/Los_Angeles",
    },
    seats: {
      registered: 14,
      capacity: 40,
      waitlisted: 2,
      cancelled: 1,
      checkedIn: 0,
      noShow: 0,
      unmarked: 14,
    },
    hours: { credited: 0, attendeesCredited: 0, attendeesCheckedIn: 0 },
    money: null,
    returning: null,
  }
}

function clockOf(overrides: Partial<EventPhaseClock> = {}): EventPhaseClock {
  return {
    status: "upcoming",
    scheduledAt: "2026-09-12T17:00:00.000Z",
    endsAt: null,
    completedAt: null,
    ...overrides,
  }
}

describe("getEventInsights contract", () => {
  it("registers one additive GET beside the analytics panels", () => {
    expect(endpoints.getEventInsights.method).toBe("GET")
    expect(endpoints.getEventInsights.path).toBe("/cleanups/:id/insights")
    expect(endpoints.getEventInsights.auth).toBe("required")
    expect(endpoints.getEventInsights.csrf).toBe(false)
    expect(endpoints.getEventInsights.version).toBe("v1")
    expect(endpoints.getEventInsights.request).toBe(GetEventInsightsRequestSchema)
    expect(endpoints.getEventInsights.response).toBe(GetEventInsightsResponseSchema)
  })

  it("takes only the path id and rejects an analytics-style range", () => {
    expect(GetEventInsightsRequestSchema.parse({ id: UUID })).toEqual({ id: UUID })
    expect(GetEventInsightsRequestSchema.safeParse({ id: UUID, range: "30d" }).success).toBe(false)
    expect(GetEventInsightsRequestSchema.safeParse({ id: "not-a-uuid" }).success).toBe(false)
    expect(GetEventInsightsRequestSchema.safeParse({}).success).toBe(false)
  })

  it("defaults every list so a minimal payload round-trips", () => {
    const parsed = GetEventInsightsResponseSchema.parse(minimalInsights())
    expect(parsed.registrationTrend).toEqual([])
    expect(parsed.byTicketType).toEqual([])
    expect(parsed.bySource).toEqual([])
    expect(parsed.broadcasts).toEqual([])
    expect(parsed.arrivals).toEqual([])
    expect(parsed.phase).toBe("upcoming")
    expect(parsed.money).toBeNull()
    expect(parsed.returning).toBeNull()
    expect(EventInsightsSchema.parse(minimalInsights())).toEqual(parsed)
  })

  it("keeps every count a seat count and every seat count non-negative", () => {
    const bad = minimalInsights() as { seats: Record<string, number> }
    bad.seats.registered = -1
    expect(GetEventInsightsResponseSchema.safeParse(bad).success).toBe(false)
    expect(SeatPointSchema.parse({ day: "2026-09-12", seats: -3 })).toEqual({
      day: "2026-09-12",
      seats: -3,
    })
    expect(ArrivalOffsetBucketSchema.safeParse({ offsetMin: -120, seats: 4 }).success).toBe(true)
    expect(ArrivalOffsetBucketSchema.safeParse({ offsetMin: 0, seats: -1 }).success).toBe(false)
  })

  it("bounds every array so no host screen pages an unbounded list", () => {
    const point = { day: "2026-09-12", seats: 1 }
    const bucket = { offsetMin: 0, seats: 1 }
    const ticketType = {
      ticketTypeId: TICKET_UUID,
      name: "General",
      registered: 1,
      capacity: null,
      waitlisted: 0,
      checkedIn: 0,
    }
    const broadcast = {
      id: BROADCAST_UUID,
      kind: "host_broadcast",
      finishedAt: null,
      recipients: 1,
      sent: 1,
      failed: 0,
      suppressed: 0,
    }
    expect(InsightsTicketTypeSchema.safeParse(ticketType).success).toBe(true)
    expect(InsightsBroadcastSchema.safeParse(broadcast).success).toBe(true)
    const overflow = {
      ...(minimalInsights() as Record<string, unknown>),
      registrationTrend: Array.from({ length: MAX_INSIGHTS_TREND_DAYS + 1 }, () => point),
      byTicketType: Array.from({ length: MAX_INSIGHTS_TICKET_TYPES + 1 }, () => ticketType),
      broadcasts: Array.from({ length: MAX_INSIGHTS_BROADCASTS + 1 }, () => broadcast),
      arrivals: Array.from({ length: MAX_INSIGHTS_ARRIVAL_BUCKETS + 1 }, () => bucket),
    }
    expect(GetEventInsightsResponseSchema.safeParse(overflow).success).toBe(false)
    const atCap = {
      ...(minimalInsights() as Record<string, unknown>),
      registrationTrend: Array.from({ length: MAX_INSIGHTS_TREND_DAYS }, () => point),
      byTicketType: Array.from({ length: MAX_INSIGHTS_TICKET_TYPES }, () => ticketType),
      broadcasts: Array.from({ length: MAX_INSIGHTS_BROADCASTS }, () => broadcast),
      arrivals: Array.from({ length: MAX_INSIGHTS_ARRIVAL_BUCKETS }, () => bucket),
    }
    expect(GetEventInsightsResponseSchema.safeParse(atCap).success).toBe(true)
  })

  it("carries money and returning as whole nullable blocks, never partial ones", () => {
    const withMoney = {
      ...(minimalInsights() as Record<string, unknown>),
      money: {
        currency: "USD",
        donationCount: 3,
        grossMinor: 12000,
        netMinor: 11500,
        refundedMinor: 0,
        lastChargedAt: "2026-09-12T18:30:00.000Z",
      },
      returning: { seats: 5, ofRegistered: 14 },
    }
    const parsed = GetEventInsightsResponseSchema.parse(withMoney)
    expect(parsed.money?.currency).toBe("USD")
    expect(parsed.returning).toEqual({ seats: 5, ofRegistered: 14 })
    const eur = {
      ...withMoney,
      money: { ...(withMoney.money as Record<string, unknown>), currency: "EUR" },
    }
    expect(GetEventInsightsResponseSchema.safeParse(eur).success).toBe(false)
  })

  it("names exactly four phases and carries no suppression flag", () => {
    expect(EventPhaseSchema.options).toEqual(["upcoming", "live", "ended", "cancelled"])
    const parsed = GetEventInsightsResponseSchema.parse(minimalInsights())
    expect(Object.keys(parsed)).not.toContain("k")
    expect(Object.keys(parsed)).not.toContain("suppressed")
    expect(Object.keys(parsed)).not.toContain("exact")
  })
})

describe("eventPhase", () => {
  it("reads cancelled off the status, whatever the clock says", () => {
    for (const now of [START - LIVE_LEAD_MS - 1, START, START + DEFAULT_DURATION_MS + LIVE_TAIL_MS]) {
      expect(eventPhase(clockOf({ status: "cancelled" }), now)).toBe("cancelled")
    }
  })

  it("reads ended off a done status even mid-window", () => {
    expect(eventPhase(clockOf({ status: "done" }), START)).toBe("ended")
    expect(eventPhase(clockOf({ status: "done" }), START - LIVE_LEAD_MS - 1)).toBe("ended")
  })

  it("goes live exactly two hours before the start and not a millisecond earlier", () => {
    const clock = clockOf()
    expect(eventPhase(clock, START - LIVE_LEAD_MS - 1)).toBe("upcoming")
    expect(eventPhase(clock, START - LIVE_LEAD_MS)).toBe("live")
    expect(eventPhase(clock, START)).toBe("live")
  })

  it("stays live until two hours past the end, then ends", () => {
    const end = START + DEFAULT_DURATION_MS
    const clock = clockOf()
    expect(eventPhase(clock, end)).toBe("live")
    expect(eventPhase(clock, end + LIVE_TAIL_MS - 1)).toBe("live")
    expect(eventPhase(clock, end + LIVE_TAIL_MS)).toBe("ended")
  })

  it("prefers an explicit endsAt over the four-hour default", () => {
    const endsAt = "2026-09-12T18:00:00.000Z"
    const end = Date.parse(endsAt)
    const clock = clockOf({ status: "active", endsAt })
    expect(eventPhase(clock, end + LIVE_TAIL_MS - 1)).toBe("live")
    expect(eventPhase(clock, end + LIVE_TAIL_MS)).toBe("ended")
    expect(eventPhase(clockOf({ status: "active" }), end + LIVE_TAIL_MS)).toBe("live")
  })

  it("covers every status against a window it does not agree with", () => {
    const before = START - LIVE_LEAD_MS - 1
    const during = START + 1
    const after = START + DEFAULT_DURATION_MS + LIVE_TAIL_MS
    const cases: Array<[EventPhaseClock["status"], string, string, string]> = [
      ["upcoming", "upcoming", "live", "ended"],
      ["active", "upcoming", "live", "ended"],
      ["done", "ended", "ended", "ended"],
      ["cancelled", "cancelled", "cancelled", "cancelled"],
    ]
    for (const [status, atBefore, atDuring, atAfter] of cases) {
      expect(eventPhase(clockOf({ status }), before), status).toBe(atBefore)
      expect(eventPhase(clockOf({ status }), during), status).toBe(atDuring)
      expect(eventPhase(clockOf({ status }), after), status).toBe(atAfter)
    }
  })

  it("fails closed to upcoming on an unusable clock", () => {
    expect(eventPhase(clockOf({ scheduledAt: "not a date" }), START)).toBe("upcoming")
    expect(eventPhase(clockOf({ scheduledAt: "" }), START)).toBe("upcoming")
    expect(eventPhase(clockOf(), Number.NaN)).toBe("upcoming")
    expect(eventPhase(clockOf({ endsAt: "not a date" }), START + DEFAULT_DURATION_MS)).toBe("live")
  })

  it("accepts an undefined endsAt exactly as it accepts null", () => {
    const end = START + DEFAULT_DURATION_MS + LIVE_TAIL_MS
    expect(eventPhase({ status: "upcoming", scheduledAt: "2026-09-12T17:00:00.000Z" }, end)).toBe(
      "ended",
    )
  })

  it("returns a value the response schema accepts, for every phase", () => {
    const phases = new Set(
      [
        eventPhase(clockOf(), START - LIVE_LEAD_MS - 1),
        eventPhase(clockOf(), START),
        eventPhase(clockOf(), START + DEFAULT_DURATION_MS + LIVE_TAIL_MS),
        eventPhase(clockOf({ status: "cancelled" }), START),
      ].map((phase) => EventPhaseSchema.parse(phase)),
    )
    expect([...phases].sort()).toEqual(["cancelled", "ended", "live", "upcoming"])
  })
})

describe("insights authz invariant (DECISIONS §35)", () => {
  it("gives view_roster to every standing that holds view_analytics", () => {
    const eventRoles = [null, ...CleanupMemberRoleSchema.options]
    const orgRoles = [null, ...OrganizationMemberRoleSchema.options]
    let analyticsHolders = 0
    for (const eventRole of eventRoles) {
      for (const orgRole of orgRoles) {
        const standing = { eventRole, orgRole } as HostStanding
        if (!can(standing, "view_analytics")) continue
        analyticsHolders += 1
        expect(can(standing, "view_roster"), `${eventRole ?? "none"}|${orgRole ?? "none"}`).toBe(
          true,
        )
      }
    }
    expect(analyticsHolders).toBeGreaterThan(0)
  })

  it("keeps staff on the roster without analytics, and members off both", () => {
    const staff: HostStanding = { eventRole: "staff", orgRole: null }
    expect(can(staff, "view_roster")).toBe(true)
    expect(can(staff, "view_analytics")).toBe(false)
    const member: HostStanding = { eventRole: "member", orgRole: "member" }
    expect(can(member, "view_roster")).toBe(false)
    expect(can(member, "view_analytics")).toBe(false)
  })
})
