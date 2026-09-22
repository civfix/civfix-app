import { describe, expect, it } from "vitest"
import type {
  EventAnalyticsLifecycle,
  GetEventAnalyticsResponse,
  SeriesPoint,
} from "@civfix/shared"
import {
  ANALYTICS_PANELS,
  ARCHIVAL_AFTER_DAYS,
  DAY_MS,
  LIFECYCLE_SEGMENTS,
  REACH_RATE_MIN_VIEWS,
  analyticsPanelOrder,
  comparisonVerdict,
  comparisonVisible,
  defaultSegment,
  funnelBars,
  hasSeriesData,
  isArchivalEvent,
  ratePercent,
  reachRateVisible,
  segmentEnabled,
  segmentRange,
  seriesPoints,
  seriesValues,
  sliceSeries,
  slotsPanelVisible,
  visibleAnalyticsPanels,
} from "../analyticsModel"

const CREATED = Date.parse("2026-09-01T00:00:00.000Z")
const START = Date.parse("2026-09-10T16:00:00.000Z")
const END = Date.parse("2026-09-10T20:00:00.000Z")

const iso = (at: number): string => new Date(at).toISOString()

const LIFECYCLE: EventAnalyticsLifecycle = {
  createdAt: iso(CREATED),
  startAt: iso(START),
  endAt: iso(END),
  completedAt: null,
}

const rate = (value: number | null, suppressed = false) => ({
  value,
  numerator: null,
  denominator: null,
  suppressed,
})

function analytics(over: Partial<GetEventAnalyticsResponse> = {}): GetEventAnalyticsResponse {
  return {
    generatedAt: iso(END),
    k: 5,
    scope: "full",
    phase: "upcoming",
    lifecycle: LIFECYCLE,
    kpis: {
      signups: 20,
      capacity: 40,
      waitlisted: 0,
      cancelled: 0,
      checkedIn: 0,
      noShow: 0,
      walkUps: 0,
      pageViews: 100,
      uniqueViewers: null,
      shares: null,
      donationClicks: 0,
      hoursTotal: 0,
      hoursVolunteers: 0,
      reportsLinked: 0,
      reportsResolved: 0,
      postsCreated: 0,
    },
    rates: {
      checkIn: rate(null, true),
      noShow: rate(null, true),
      fill: rate(0.5),
      viewToSignup: rate(0.2),
      waitlistConversion: rate(null, true),
    },
    deltas: { signups7d: 3, views7d: 12 },
    signups: { cumulative: [], daily: [], cancellations: [] },
    reach: { viewsDaily: [], funnel: [] },
    eventDay: { arrivals: [] },
    impact: {},
    ...over,
  }
}

const point = (at: number, value: number | null, suppressed = false): SeriesPoint => ({
  day: iso(at),
  value,
  suppressed,
})

const dayPoint = (day: string, value: number | null): SeriesPoint => ({
  day,
  value,
  suppressed: false,
})

describe("the carousel reads as the event's own story", () => {
  it("leads with sign-ups before the event, arrivals on the day and impact after", () => {
    expect(analyticsPanelOrder("upcoming")[0]).toBe("signups")
    expect(analyticsPanelOrder("day_of")[0]).toBe("checkins")
    expect(analyticsPanelOrder("completed")[0]).toBe("impact")
    expect(analyticsPanelOrder("archived")[0]).toBe("impact")
  })

  it("names every panel in every order, so no order silently drops one", () => {
    for (const phase of ["upcoming", "day_of", "completed", "archived"] as const) {
      expect([...analyticsPanelOrder(phase)].sort()).toEqual([...ANALYTICS_PANELS].sort())
    }
  })

  it("drops the shifts panel when there is neither a shift nor a capacity to fill", () => {
    const capped = analytics()
    expect(slotsPanelVisible(capped)).toBe(true)
    const uncapped = analytics({ kpis: { ...capped.kpis, capacity: null } })
    expect(slotsPanelVisible(uncapped)).toBe(false)
    expect(visibleAnalyticsPanels(uncapped)).not.toContain("slots")
    expect(visibleAnalyticsPanels(uncapped)).toHaveLength(ANALYTICS_PANELS.length - 1)
  })

  it("keeps the panel when there are shifts but no capacity", () => {
    const withSlots = analytics({
      kpis: { ...analytics().kpis, capacity: null },
      signups: {
        cumulative: [],
        daily: [],
        cancellations: [],
        bySlot: { panelSuppressed: false, rows: [{ key: "s1", label: "Trash", value: 3, suppressed: false }] },
      },
    })
    expect(slotsPanelVisible(withSlots)).toBe(true)
  })
})

describe("a long-finished event is a record, not a dashboard", () => {
  it("collapses only once the window has passed", () => {
    const ended = { ...LIFECYCLE, completedAt: iso(END) }
    expect(isArchivalEvent(ended, "completed", END + DAY_MS)).toBe(false)
    expect(isArchivalEvent(ended, "completed", END + (ARCHIVAL_AFTER_DAYS + 1) * DAY_MS)).toBe(true)
  })

  it("trusts the server when it already says archived, and never collapses a live one", () => {
    expect(isArchivalEvent(LIFECYCLE, "archived", END)).toBe(true)
    expect(isArchivalEvent(LIFECYCLE, "day_of", END + 400 * DAY_MS)).toBe(false)
    expect(isArchivalEvent({ ...LIFECYCLE, endAt: null, completedAt: null }, "completed", END)).toBe(
      false,
    )
  })
})

describe("the lifecycle scrubber replaces a rolling window", () => {
  it("names four phases and nothing that looks like a date picker", () => {
    expect([...LIFECYCLE_SEGMENTS]).toEqual(["lead_up", "event_day", "follow_up", "all"])
  })

  it("runs lead-up from creation to the start, and follow-up from the end forward", () => {
    expect(segmentRange("lead_up", LIFECYCLE, END)).toEqual({ from: CREATED, to: START })
    const follow = segmentRange("follow_up", LIFECYCLE, END + DAY_MS)
    expect(follow.from).toBe(END)
    expect(follow.to).toBe(END + DAY_MS)
  })

  it("pads the event-day window either side, so an early arrival is not cut off", () => {
    const day = segmentRange("event_day", LIFECYCLE, END)
    expect(day.from).toBeLessThan(START)
    expect(day.to).toBeGreaterThan(END)
  })

  it("disables a segment that cannot have data yet", () => {
    expect(segmentEnabled("follow_up", LIFECYCLE, START)).toBe(false)
    expect(segmentEnabled("follow_up", LIFECYCLE, END + 1)).toBe(true)
    expect(segmentEnabled("event_day", LIFECYCLE, CREATED)).toBe(false)
    expect(segmentEnabled("all", LIFECYCLE, CREATED)).toBe(true)
  })

  it("opens on the phase the event is in, falling back to All when that one is dead", () => {
    expect(defaultSegment("upcoming", LIFECYCLE, CREATED)).toBe("lead_up")
    expect(defaultSegment("day_of", LIFECYCLE, START)).toBe("event_day")
    expect(defaultSegment("completed", LIFECYCLE, END + DAY_MS)).toBe("follow_up")
    expect(defaultSegment("completed", LIFECYCLE, START)).toBe("all")
  })

  it("slices the server's whole series client-side rather than refetching per segment", () => {
    const series = [point(CREATED, 1), point(START, 5), point(END + DAY_MS, 9)]
    expect(sliceSeries(series, { from: CREATED, to: START }).map((p) => p.value)).toEqual([1, 5])
  })

  it("keeps the whole series rather than drawing an empty chart when a slice is empty", () => {
    const series = [point(CREATED, 1)]
    expect(sliceSeries(series, { from: END, to: END + DAY_MS })).toEqual(series)
  })

  it("selects the event's own day from a daily-bucketed series, not the whole series", () => {
    const series = [dayPoint("2026-09-09", 1), dayPoint("2026-09-10", 7), dayPoint("2026-09-11", 2)]
    const day = segmentRange("event_day", LIFECYCLE, END)
    expect(sliceSeries(series, day).map((p) => p.value)).toEqual([7])
  })

  it("still ends a daily lead-up at the day the event starts", () => {
    const series = [dayPoint("2026-09-09", 1), dayPoint("2026-09-10", 7), dayPoint("2026-09-11", 2)]
    const lead = segmentRange("lead_up", LIFECYCLE, END)
    expect(sliceSeries(series, lead).map((p) => p.value)).toEqual([1, 7])
  })
})

describe("a suppressed point never reads as a zero", () => {
  it("hands the charts a null, not the value the server hid", () => {
    expect(seriesValues([point(CREATED, 4), point(START, 2, true)])).toEqual([4, null])
    expect(seriesPoints([point(CREATED, 4), point(START, 2, true)])).toEqual([
      { x: CREATED, y: 4 },
      { x: START, y: null },
    ])
  })

  it("calls a series with nothing in it empty, so the panel shows its empty state", () => {
    expect(hasSeriesData([])).toBe(false)
    expect(hasSeriesData([point(CREATED, 0)])).toBe(false)
    expect(hasSeriesData([point(CREATED, 0), point(START, 1)])).toBe(true)
    expect(hasSeriesData([point(CREATED, 9, true)])).toBe(false)
  })

  it("reads a suppressed rate as nothing to show, not as zero percent", () => {
    expect(ratePercent(rate(0.42))).toBe(42)
    expect(ratePercent(rate(0.42, true))).toBeNull()
    expect(ratePercent(rate(null))).toBeNull()
    expect(ratePercent(undefined)).toBeNull()
  })

  it("hides the conversion rate under a handful of views instead of rounding a silly number", () => {
    expect(reachRateVisible(REACH_RATE_MIN_VIEWS - 1, rate(0.5))).toBe(false)
    expect(reachRateVisible(REACH_RATE_MIN_VIEWS, rate(0.5))).toBe(true)
    expect(reachRateVisible(1000, rate(null, true))).toBe(false)
    expect(reachRateVisible(null, rate(0.5))).toBe(false)
  })
})

describe("the funnel is the lifecycle's own progress bar", () => {
  const steps = [
    { step: "page_views", label: "Views", value: 100, suppressed: false },
    { step: "signups", label: "Sign-ups", value: 25, suppressed: false },
    { step: "checked_in", label: "Checked in", value: 0, suppressed: false },
    { step: "logged_hours", label: "Hours", value: 0, suppressed: false },
  ]

  it("scales every bar against the top step and names each one's share of the step before", () => {
    const bars = funnelBars(steps)
    expect(bars[0]?.fraction).toBe(1)
    expect(bars[0]?.ofPrevious).toBeNull()
    expect(bars[1]?.fraction).toBe(0.25)
    expect(bars[1]?.ofPrevious).toBe(25)
  })

  it("ghosts the steps the lifecycle has not reached, instead of drawing them as real zeroes", () => {
    const bars = funnelBars(steps)
    expect(bars[0]?.ghost).toBe(false)
    expect(bars[2]?.ghost).toBe(true)
    expect(bars[3]?.ghost).toBe(true)
  })

  it("survives a suppressed top step without dividing by it", () => {
    const bars = funnelBars([{ step: "page_views", label: "Views", value: null, suppressed: true }])
    expect(bars[0]).toEqual({ step: "page_views", value: null, fraction: 0, ofPrevious: null, ghost: true })
  })

  it("draws nothing at all for an empty funnel", () => {
    expect(funnelBars([])).toEqual([])
  })
})

describe("comparison against the host's own median, never against other hosts", () => {
  it("appears only once there are enough finished events to have a median", () => {
    expect(comparisonVisible(analytics())).toBe(false)
    expect(
      comparisonVisible(
        analytics({
          comparison: {
            sampleSize: 3,
            medians: { signups: 10, checkInRate: 0.5, hoursPerVolunteer: 2, fillRate: 0.5 },
          },
        }),
      ),
    ).toBe(true)
  })

  it("calls a tenth either way typical, rather than reporting noise as a win", () => {
    expect(comparisonVerdict(11, 10)).toBe("typical")
    expect(comparisonVerdict(9.5, 10)).toBe("typical")
    expect(comparisonVerdict(13, 10)).toBe("above")
    expect(comparisonVerdict(8, 10)).toBe("below")
  })

  it("says so when there is nothing to compare, instead of guessing a verdict", () => {
    expect(comparisonVerdict(null, 10)).toBe("unknown")
    expect(comparisonVerdict(5, null)).toBe("unknown")
    expect(comparisonVerdict(5, 0)).toBe("unknown")
  })
})
