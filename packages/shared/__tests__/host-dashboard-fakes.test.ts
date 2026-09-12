import { describe, it, expect } from "vitest"
import {
  fakeEventInsights,
  fakeHostPortfolioKpis,
  fakeHostedEvents,
  fakeHostedEventsAnalytics,
} from "../src/fakes/index.js"
import { GetEventInsightsResponseSchema, EventPhaseSchema } from "../src/schemas/host/insights.js"
import {
  HostedEventsAnalyticsResponseSchema,
  PortfolioAnalyticsRangeSchema,
} from "../src/schemas/host/analytics.js"
import {
  HostPortfolioKpisSchema,
  ListMyHostedEventsResponseSchema,
} from "../src/schemas/host/portfolio.js"
import { eventPhase } from "../src/host/phase.js"


const NOW = Date.parse("2026-09-11T17:00:00.000Z")
const PHASES = EventPhaseSchema.options
const RANGES = PortfolioAnalyticsRangeSchema.options

describe("fakeEventInsights", () => {
  it("produces a schema-valid payload for every phase", () => {
    for (const phase of PHASES) {
      const parsed = GetEventInsightsResponseSchema.parse(fakeEventInsights(phase, { now: NOW }))
      expect(parsed.phase).toBe(phase)
    }
  })

  it("agrees with eventPhase() on its own clock", () => {
    for (const phase of PHASES) {
      const insights = fakeEventInsights(phase, { now: NOW })
      const derived = eventPhase(
        {
          status: insights.clock.status,
          scheduledAt: insights.clock.startsAt,
          endsAt: insights.clock.endsAt,
          completedAt: insights.clock.completedAt,
        },
        NOW,
      )
      expect(derived).toBe(phase)
    }
  })

  it("is deterministic for the same phase, seed and clock", () => {
    expect(fakeEventInsights("live", { seed: 3, now: NOW })).toEqual(
      fakeEventInsights("live", { seed: 3, now: NOW }),
    )
  })

  it("varies the registration trend with the seed and still ends at the registered seats", () => {
    const a = fakeEventInsights("ended", { seed: 1, now: NOW })
    const b = fakeEventInsights("ended", { seed: 9, now: NOW })
    expect(a.registrationTrend).not.toEqual(b.registrationTrend)
    for (const insights of [a, b]) {
      expect(insights.registrationTrend).toHaveLength(14)
      expect(insights.registrationTrend.at(-1)?.seats).toBe(insights.seats.registered)
      const days = insights.registrationTrend.map((point) => point.day)
      expect(new Set(days).size).toBe(days.length)
      const seats = insights.registrationTrend.map((point) => point.seats)
      expect([...seats].sort((x, y) => x - y)).toEqual(seats)
    }
  })

  it("keeps the seat arithmetic consistent", () => {
    for (const phase of PHASES) {
      const { seats, byTicketType, bySource, arrivals, hours } = fakeEventInsights(phase, { now: NOW })
      expect(seats.checkedIn + seats.noShow + seats.unmarked).toBe(seats.registered)
      expect(byTicketType.reduce((sum, row) => sum + row.registered, 0)).toBe(seats.registered)
      expect(byTicketType.reduce((sum, row) => sum + row.waitlisted, 0)).toBe(seats.waitlisted)
      expect(byTicketType.reduce((sum, row) => sum + row.checkedIn, 0)).toBe(seats.checkedIn)
      expect(bySource.reduce((sum, row) => sum + row.seats, 0)).toBe(seats.registered)
      expect(arrivals.reduce((sum, bucket) => sum + bucket.seats, 0)).toBe(
        arrivals.length === 0 ? 0 : seats.checkedIn,
      )
      expect(hours.attendeesCheckedIn).toBe(seats.checkedIn)
    }
  })

  it("gives the live and ended phases arrival buckets on a 15-minute grid", () => {
    for (const phase of ["live", "ended"] as const) {
      const { arrivals } = fakeEventInsights(phase, { now: NOW })
      expect(arrivals.length).toBeGreaterThan(0)
      for (const bucket of arrivals) expect(bucket.offsetMin % 15 === 0).toBe(true)
    }
    expect(fakeEventInsights("upcoming", { now: NOW }).arrivals).toEqual([])
    expect(fakeEventInsights("cancelled", { now: NOW }).arrivals).toEqual([])
  })

  it("carries both the present and the null money and returning variants", () => {
    expect(fakeEventInsights("ended", { now: NOW }).money).not.toBeNull()
    expect(fakeEventInsights("cancelled", { now: NOW }).money).toBeNull()
    expect(fakeEventInsights("ended", { now: NOW, money: false }).money).toBeNull()
    expect(fakeEventInsights("cancelled", { now: NOW, money: true }).money).not.toBeNull()
    expect(fakeEventInsights("ended", { now: NOW }).returning).not.toBeNull()
    expect(fakeEventInsights("ended", { now: NOW, returning: false }).returning).toBeNull()
  })

  it("turns a fully refunded event into a negative net", () => {
    const money = fakeEventInsights("ended", { now: NOW, refunded: true }).money
    expect(money?.netMinor).toBeLessThan(0)
    expect(money?.refundedMinor).toBe(money?.grossMinor)
    expect(fakeEventInsights("ended", { now: NOW }).money?.netMinor).toBeGreaterThan(0)
  })

  it("ships three broadcasts and two ticket types", () => {
    const insights = fakeEventInsights("ended", { now: NOW })
    expect(insights.broadcasts).toHaveLength(3)
    expect(insights.byTicketType).toHaveLength(2)
    expect(new Set(insights.broadcasts.map((row) => row.id)).size).toBe(3)
  })
})

describe("fakeHostedEventsAnalytics", () => {
  it("produces a schema-valid payload for every range with no suppression", () => {
    for (const range of RANGES) {
      const parsed = HostedEventsAnalyticsResponseSchema.parse(
        fakeHostedEventsAnalytics(range, { now: NOW }),
      )
      expect(parsed.range).toBe(range)
      expect(parsed.series.length).toBeGreaterThan(0)
      expect(parsed.series.every((point) => !point.suppressed)).toBe(true)
      expect(parsed.byEvent.panelSuppressed).toBe(false)
      expect(parsed.byEvent.rows).toHaveLength(5)
    }
  })

  it("populates every field the portfolio renders", () => {
    const analytics = fakeHostedEventsAnalytics("30d", { now: NOW })
    expect(analytics.totals.uniqueAttendees).not.toBeNull()
    expect(analytics.averageCheckInRate.value).not.toBeNull()
    expect(analytics.repeatAttendance.value).not.toBeNull()
    expect(analytics.bestDayTime).not.toBeNull()
  })

  it("is deterministic for the same range, seed and clock", () => {
    expect(fakeHostedEventsAnalytics("90d", { seed: 5, now: NOW })).toEqual(
      fakeHostedEventsAnalytics("90d", { seed: 5, now: NOW }),
    )
  })
})

describe("fakeHostedEvents", () => {
  it("produces a schema-valid page with kpis for each window", () => {
    for (const when of ["upcoming", "past"] as const) {
      const parsed = ListMyHostedEventsResponseSchema.parse(fakeHostedEvents(when, { now: NOW }))
      expect(parsed.items.length).toBeGreaterThan(0)
      expect(parsed.kpis).toEqual(HostPortfolioKpisSchema.parse(fakeHostPortfolioKpis()))
      expect(new Set(parsed.items.map((item) => item.id)).size).toBe(parsed.items.length)
    }
  })

  it("places upcoming events ahead of now and past events behind it", () => {
    for (const item of fakeHostedEvents("upcoming", { now: NOW }).items) {
      expect(Date.parse(item.startsAt)).toBeGreaterThan(NOW)
      expect(item.status).toBe("upcoming")
    }
    for (const item of fakeHostedEvents("past", { now: NOW }).items) {
      expect(Date.parse(item.startsAt)).toBeLessThan(NOW)
    }
  })

  it("stamps the org on every row when one is given", () => {
    const org = { orgId: "6f1a2c1e-4d9b-4c7a-8a2f-1b7c9d3e5a10", orgName: "Bayview Stewards" }
    for (const item of fakeHostedEvents("upcoming", { now: NOW, ...org }).items) {
      expect(item.orgId).toBe(org.orgId)
      expect(item.orgName).toBe(org.orgName)
    }
  })
})
