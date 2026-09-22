import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type { HostedEventDTO } from "@civfix/shared"
import { pickerOptions } from "../analyticsModel"

const BODY = readFileSync(new URL("../EventAnalyticsBody.tsx", import.meta.url), "utf8")

function hosted(over: Partial<HostedEventDTO> & { id: string }): HostedEventDTO {
  return {
    title: over.id,
    startsAt: "2026-09-01T00:00:00.000Z",
    status: "scheduled",
    visibility: "public",
    registeredCount: 0,
    capacity: null,
    checkedInCount: 0,
    waitlistCount: 0,
    myCapabilities: ["view_analytics"],
    ...over,
  } as HostedEventDTO
}

describe("the event picker lists what the viewer may actually read", () => {
  it("puts the newest event first, across both windows", () => {
    const options = pickerOptions(
      [hosted({ id: "soon", startsAt: "2026-10-01T00:00:00.000Z" })],
      [
        hosted({ id: "old", startsAt: "2026-01-01T00:00:00.000Z" }),
        hosted({ id: "recent", startsAt: "2026-08-01T00:00:00.000Z" }),
      ],
    )
    expect(options.map((option) => option.id)).toEqual(["soon", "recent", "old"])
  })

  it("drops an event whose analytics this viewer cannot see", () => {
    const options = pickerOptions([hosted({ id: "blind", myCapabilities: ["check_in"] })], [])
    expect(options).toEqual([])
  })

  it("lists an event that appears in both windows exactly once", () => {
    const both = hosted({ id: "dupe" })
    expect(pickerOptions([both], [both]).map((option) => option.id)).toEqual(["dupe"])
  })
})

describe("the page filters on an event and a range, not on a lifecycle phase", () => {
  it("has dropped the lifecycle scrubber outright", () => {
    expect(BODY).not.toContain("LIFECYCLE_SEGMENTS")
    expect(BODY).not.toContain("segmentRange")
    expect(BODY).not.toContain("segmentEnabled")
    expect(BODY).not.toContain("defaultSegment")
    expect(BODY).not.toContain("sliceSeries")
    expect(BODY).not.toContain("scrubber.")
  })

  it("picks the event through the dashboard's own popover idiom", () => {
    expect(BODY).toContain("usePopoverAnchor(setPickerRect)")
    expect(BODY).toContain("<PopoverMenu")
    expect(BODY).toContain('label: t("filter.all_events")')
    expect(BODY).toContain("useMyHostedEvents(\"upcoming\", null)")
    expect(BODY).toContain("useMyHostedEvents(\"past\", null)")
  })

  it("offers the range as a segmented control built from the presets", () => {
    expect(BODY).toContain("<SegmentedControl")
    expect(BODY).toContain("options={presets.map((key) => ({ key, label: t(`range.${key}`) }))}")
    expect(BODY).toContain("ALL_EVENTS_RANGE_PRESETS")
    expect(BODY).toContain("ANALYTICS_RANGE_PRESETS")
  })

  it("asks the server for the chosen range in all-events mode and slices client-side for one", () => {
    expect(BODY).toContain("useHostAnalyticsSummary(null, summaryRange(active), { enabled: all })")
    expect(BODY).toContain("days={presetDays(active)}")
    expect(BODY).toContain("rangeSlice(data.signups.daily, days, now)")
  })
})

describe("what the redesign took off the single-event page", () => {
  it("replaces the cumulative area chart with a capacity meter", () => {
    expect(BODY).not.toContain("AreaLineChart")
    expect(BODY).not.toContain("data.signups.cumulative")
    expect(BODY).toContain("<Meter")
    expect(BODY).toContain('t("page.capacity_line", { signups, capacity })')
  })

  it("draws the meter only when the event actually has a capacity", () => {
    expect(BODY).toContain("{capacity ? (")
  })

  it("keeps the daily bars and cancellations, now with weekly labels", () => {
    expect(BODY).toContain("stackValue: cancellationAt(cancellations, index)")
    expect(BODY.match(/xLabels=\{weeklyXLabels\(daily, weekLabel\)\}/g) ?? []).toHaveLength(2)
  })

  it("labels the arrivals scale around the event start", () => {
    expect(BODY).toContain("xLabels={arrivalXLabels(arrivals,")
    expect(BODY).toContain('t("attendance.offset_start")')
    expect(BODY).toContain('t("attendance.offset_before", { hours: Math.abs(minutes) / 60 })')
    expect(BODY).toContain('t("attendance.offset_after", { hours: minutes / 60 })')
  })

  it("puts the whole event behind the sign-ups tile, since capacity now has its own meter", () => {
    expect(BODY).toContain('hint={t("range.whole_event")}')
    expect(BODY).not.toContain("kpi.of_capacity")
  })

  it("hides the page-view and donation tiles until there is something to show", () => {
    expect(BODY).toContain("{views > 0 ? (")
    expect(BODY).toContain("{donations > 0 ? (")
  })

  it("captions the sources section only once the page has been viewed", () => {
    expect(BODY).toContain("{views > 0 && percent !== null ? (")
    expect(BODY).toContain('t("page.sources_caption", { rate: percent, views })')
  })
})

describe("the all-events mode answers for the whole portfolio", () => {
  it("names the events-held and reports-linked tiles the summary now carries", () => {
    expect(BODY).toContain('t("kpi.events_held")')
    expect(BODY).toContain('t("kpi.reports_linked")')
    expect(BODY).toContain('t("kpi.checked_in_held"')
  })

  it("lets a by-event row set the filter instead of leaving the page", () => {
    expect(BODY).toContain("onPress={() => onPickEvent(row.key)}")
    expect(BODY).toContain("const rows = data.byEvent.rows.slice(0, MAX_BY_EVENT_ROWS)")
    expect(BODY).toContain("const MAX_BY_EVENT_ROWS = 12")
  })

  it("answers a press on that row, not only a web hover", () => {
    expect(BODY).toContain("state.pressed || webHover(state)")
  })

  it("still carries the suppression note in both modes", () => {
    expect(BODY.match(/t\("suppressed\.note", \{ k: data\.k \}\)/g) ?? []).toHaveLength(2)
  })
})
