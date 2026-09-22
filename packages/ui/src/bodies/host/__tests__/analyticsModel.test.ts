import { describe, expect, it } from "vitest"
import type {
  GetEventAnalyticsResponse,
  HostAnalyticsSummaryActivity,
  SeriesPoint,
} from "@civfix/shared"
import {
  ALL_EVENTS_RANGE_PRESETS,
  ANALYTICS_RANGE_PRESETS,
  ARRIVAL_LABEL_MINUTES,
  DAY_MS,
  DEFAULT_ALL_EVENTS_PRESET,
  DEFAULT_EVENT_PRESET,
  SUMMARY_PANELS,
  arrivalXLabels,
  busiestRows,
  comparisonVerdict,
  comparisonVisible,
  funnelBars,
  hasSeriesData,
  presetDays,
  rangeSlice,
  ratePercent,
  seriesPoints,
  seriesValues,
  summaryImpactRows,
  weeklyXLabels,
} from "../analyticsModel"

const CREATED = Date.parse("2026-09-01T00:00:00.000Z")
const START = Date.parse("2026-09-10T16:00:00.000Z")
const END = Date.parse("2026-09-10T20:00:00.000Z")

const iso = (at: number): string => new Date(at).toISOString()

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
    lifecycle: {
      createdAt: iso(CREATED),
      startAt: iso(START),
      endAt: iso(END),
      completedAt: null,
    },
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

const bucket = (minutes: number, value: number): SeriesPoint => ({
  day: String(minutes),
  value,
  suppressed: false,
})

const row = (key: string, value: number | null, suppressed = false) =>
  ({ key, label: key, value, suppressed }) as const

const activity = (
  over: Partial<HostAnalyticsSummaryActivity> = {},
): HostAnalyticsSummaryActivity => ({
  signups: 0,
  cancellations: 0,
  hoursTotal: 0,
  hoursVolunteers: 0,
  reportsLinked: 0,
  reportsResolved: 0,
  postsCreated: 0,
  donationClicks: 0,
  ...over,
})

describe("the dashboard card is four fixed panels, not a phase-dependent shuffle", () => {
  it("names the four panels the 30-day summary can always fill", () => {
    expect([...SUMMARY_PANELS]).toEqual(["signups", "checkins", "hours", "impact"])
  })
})

describe("the range presets replace the lifecycle scrubber", () => {
  it("offers a whole-event preset only when a single event is in scope", () => {
    expect([...ANALYTICS_RANGE_PRESETS]).toEqual(["whole_event", "7d", "30d", "90d", "all"])
    expect([...ALL_EVENTS_RANGE_PRESETS]).toEqual(["7d", "30d", "90d", "all"])
    expect(ALL_EVENTS_RANGE_PRESETS).not.toContain("whole_event")
  })

  it("opens on 30 days across every event and on the whole event for one", () => {
    expect(DEFAULT_ALL_EVENTS_PRESET).toBe("30d")
    expect(DEFAULT_EVENT_PRESET).toBe("whole_event")
    expect(ANALYTICS_RANGE_PRESETS[0]).toBe("whole_event")
  })

  it("turns each preset into the number of days it slices, or none at all", () => {
    expect(presetDays("7d")).toBe(7)
    expect(presetDays("30d")).toBe(30)
    expect(presetDays("90d")).toBe(90)
    expect(presetDays("all")).toBeNull()
    expect(presetDays("whole_event")).toBeNull()
  })
})

describe("slicing a series only ever drops points", () => {
  const series = [
    dayPoint("2026-09-01", 1),
    dayPoint("2026-09-08", 2),
    dayPoint("2026-09-10", 3),
  ]
  const now = Date.parse("2026-09-10T20:00:00.000Z")

  it("keeps the points inside the window and nothing older", () => {
    expect(rangeSlice(series, 7, now).map((p) => p.value)).toEqual([2, 3])
    expect(rangeSlice(series, 2, now).map((p) => p.value)).toEqual([3])
  })

  it("returns an EMPTY series rather than silently falling back to the whole one", () => {
    expect(rangeSlice(series, 1, now + 30 * DAY_MS)).toEqual([])
  })

  it("passes the whole series through when there is no window to apply", () => {
    expect(rangeSlice(series, null, now)).toEqual(series)
    expect(rangeSlice(series, 0, now)).toEqual(series)
  })

  it("never drops a point whose bucket key is not a date", () => {
    const buckets = [bucket(-60, 1), bucket(0, 4)]
    expect(rangeSlice(buckets, 7, now)).toEqual(buckets)
  })
})

describe("a daily chart labels weeks, not every single day", () => {
  it("puts one label on the first day of each ISO week", () => {
    const series = [
      dayPoint("2026-09-05", 1),
      dayPoint("2026-09-06", 1),
      dayPoint("2026-09-07", 1),
      dayPoint("2026-09-08", 1),
      dayPoint("2026-09-14", 1),
    ]
    expect(weeklyXLabels(series, (day) => day)).toEqual([
      { index: 2, text: "2026-09-07" },
      { index: 4, text: "2026-09-14" },
    ])
  })

  it("labels nothing at all when no Monday falls inside the stretch", () => {
    expect(weeklyXLabels([dayPoint("2026-09-05", 1)], (day) => day)).toEqual([])
    expect(weeklyXLabels([], (day) => day)).toEqual([])
  })

  it("skips a point whose bucket key is not a date rather than mislabelling it", () => {
    expect(weeklyXLabels([bucket(0, 3)], (day) => day)).toEqual([])
  })
})

describe("the arrivals chart labels the hour around the start, not the raw minute", () => {
  it("anchors a label on each bucket the event-day scale needs", () => {
    const buckets = [bucket(-60, 1), bucket(-45, 2), bucket(0, 9), bucket(60, 4), bucket(120, 1)]
    expect(arrivalXLabels(buckets, (minutes) => String(minutes))).toEqual([
      { index: 0, text: "-60" },
      { index: 2, text: "0" },
      { index: 3, text: "60" },
      { index: 4, text: "120" },
    ])
    expect([...ARRIVAL_LABEL_MINUTES]).toEqual([-60, 0, 60, 120])
  })

  it("leaves out a label whose bucket the event never produced", () => {
    expect(arrivalXLabels([bucket(0, 9)], String)).toEqual([{ index: 0, text: "0" }])
    expect(arrivalXLabels([], String)).toEqual([])
  })
})

describe("the impact panel counts exact aggregates, so a real zero reads as a zero", () => {
  it("always names resolved reports and posts, even at nothing", () => {
    expect(summaryImpactRows(activity())).toEqual([
      { key: "resolved", value: 0 },
      { key: "posts", value: 0 },
    ])
  })

  it("adds the donation row only once a tap has actually happened", () => {
    expect(summaryImpactRows(activity({ donationClicks: 0 })).map((r) => r.key)).not.toContain(
      "donations",
    )
    expect(summaryImpactRows(activity({ donationClicks: 3 }))).toContainEqual({
      key: "donations",
      value: 3,
    })
  })

  it("reports the server's own counts rather than rounding them", () => {
    const rows = summaryImpactRows(activity({ reportsResolved: 7, postsCreated: 2 }))
    expect(rows).toEqual([
      { key: "resolved", value: 7 },
      { key: "posts", value: 2 },
    ])
  })
})

describe("what a glance-sized panel is allowed to plot", () => {
  it("keeps the busiest rows, so the bars stay inside the panel", () => {
    const rows = [row("a", 1), row("b", 9), row("c", 4), row("d", 7), row("e", 2), row("f", 6)]
    expect(busiestRows(rows).map((r) => r.key)).toEqual(["b", "d", "f", "c"])
  })

  it("sinks a suppressed row below every countable one", () => {
    const rows = [row("hidden", null, true), row("a", 0), row("b", 3)]
    expect(busiestRows(rows).map((r) => r.key)).toEqual(["b", "a", "hidden"])
  })

  it("returns everything it has when there is less than a panelful", () => {
    expect(busiestRows([row("a", 1)])).toHaveLength(1)
    expect(busiestRows([])).toEqual([])
    expect(busiestRows([row("a", 1)], 0)).toEqual([])
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
})

describe("the funnel is the event's own progress bar", () => {
  const steps = [
    { step: "signups", label: "Sign-ups", value: 25, suppressed: false },
    { step: "checked_in", label: "Checked in", value: 0, suppressed: false },
    { step: "logged_hours", label: "Hours", value: 0, suppressed: false },
  ]

  it("scales every bar against the top step and names each one's share of the step before", () => {
    const bars = funnelBars(steps)
    expect(bars.map((bar) => bar.step)).toEqual(["signups", "checked_in", "logged_hours"])
    expect(bars[0]?.fraction).toBe(1)
    expect(bars[0]?.ofPrevious).toBeNull()
  })

  it("ghosts the steps the event has not reached, instead of drawing them as real zeroes", () => {
    const bars = funnelBars(steps)
    expect(bars[0]?.ghost).toBe(false)
    expect(bars[1]?.ghost).toBe(true)
    expect(bars[2]?.ghost).toBe(true)
  })

  it("survives a suppressed top step without dividing by it", () => {
    const bars = funnelBars([{ step: "signups", label: "Sign-ups", value: null, suppressed: true }])
    expect(bars[0]).toEqual({
      step: "signups",
      value: null,
      fraction: 0,
      ofPrevious: null,
      ghost: true,
    })
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
