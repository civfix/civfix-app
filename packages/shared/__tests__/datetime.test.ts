import { describe, it, expect, vi } from "vitest"
import {
  relativeAgo,
  eventChip,
  dowLabel,
  timeLabel,
  timeRangeLabel,
  COMMON_TIMEZONES,
  eventWhenLabel,
  eventWhenParts,
  isValidTimeZone,
  sameOffsetAt,
  supportedTimeZones,
  wallClockExistsInZone,
  wallClockInZone,
  wallClockToInstantMs,
  zoneOffsetMs,
  zoneShortName,
} from "../src/datetime.js"

/**
 * relativeAgo reconciles three former impls into one. These lock every bucket boundary with an injected
 * `now` so the function is deterministic, plus the future case, the justNow override, the absolute
 * fallback past one week, and the invalid-input guard.
 */

const NOW = new Date("2026-06-01T12:00:00.000Z")
const nowMs = NOW.getTime()

function ago(ms: number): string {
  return relativeAgo(new Date(nowMs - ms), NOW)
}

describe("relativeAgo buckets", () => {
  it("renders 'now' for the current instant and sub-minute ages", () => {
    expect(ago(0)).toBe("now")
    expect(ago(1_000)).toBe("now")
    expect(ago(59_000)).toBe("now")
  })

  it("renders whole minutes from 1m up to 59m", () => {
    expect(ago(60_000)).toBe("1m")
    expect(ago(90_000)).toBe("1m") // floored
    expect(ago(59 * 60_000)).toBe("59m")
  })

  it("renders whole hours from 1h up to 23h", () => {
    expect(ago(60 * 60_000)).toBe("1h")
    expect(ago(23 * 60 * 60_000)).toBe("23h")
  })

  it("renders whole days from 1d up to 6d", () => {
    expect(ago(24 * 60 * 60_000)).toBe("1d")
    expect(ago(6 * 24 * 60 * 60_000)).toBe("6d")
  })

  it("renders whole weeks at and beyond 7 days by default (no absolute fallback)", () => {
    expect(ago(7 * 24 * 60 * 60_000)).toBe("1w")
    expect(ago(21 * 24 * 60 * 60_000)).toBe("3w")
  })

  it("treats a future timestamp as 'now'", () => {
    expect(relativeAgo(new Date(nowMs + 60_000), NOW)).toBe("now")
  })
})

describe("relativeAgo options + inputs", () => {
  it("honors a justNow override", () => {
    expect(relativeAgo(new Date(nowMs - 1000), NOW, { justNow: "just now" })).toBe("just now")
  })

  it("uses absoluteFallback past one week instead of the week bucket", () => {
    const out = relativeAgo(new Date(nowMs - 30 * 24 * 60 * 60_000), NOW, {
      absoluteFallback: (d) => `on ${d.toISOString().slice(0, 10)}`,
    })
    expect(out).toBe("on 2026-05-02")
  })

  it("accepts an ISO string, a Date, and an epoch-ms number for both date and now", () => {
    const past = nowMs - 2 * 60 * 60_000 // 2h
    expect(relativeAgo(new Date(past).toISOString(), NOW)).toBe("2h")
    expect(relativeAgo(new Date(past), nowMs)).toBe("2h")
    expect(relativeAgo(past, nowMs)).toBe("2h")
  })

  it("defaults now to the current time when omitted", () => {
    // Using the real clock: a timestamp ~3h in the past renders '3h' regardless of the exact instant.
    const threeHoursAgo = Date.now() - 3 * 60 * 60_000 - 1000
    expect(relativeAgo(threeHoursAgo)).toBe("3h")
  })

  it("returns '' for an unparseable input rather than throwing", () => {
    expect(relativeAgo("not a date", NOW)).toBe("")
    expect(relativeAgo(Number.NaN, NOW)).toBe("")
  })

  it("returns '' for an infinite or out-of-range epoch instead of 'now' or 'Infinityw'", () => {
    const absoluteFallback = vi.fn(() => "fallback")
    expect(relativeAgo(Number.POSITIVE_INFINITY, NOW)).toBe("")
    expect(relativeAgo(Number.NEGATIVE_INFINITY, NOW)).toBe("")
    expect(relativeAgo(-1e300, NOW, { absoluteFallback })).toBe("")
    expect(relativeAgo(NOW.getTime() - 60_000, Number.POSITIVE_INFINITY)).toBe("")
    expect(absoluteFallback).not.toHaveBeenCalled()
  })
})

/**
 * eventChip / dowLabel / timeLabel are the pure date/clock formatters the profile + event surfaces share.
 * The instants are pinned at noon UTC so the calendar day is the same across every test-machine timezone
 * (a noon-UTC date never rolls back to the prior day or forward to the next in any real TZ offset).
 */
describe("eventChip", () => {
  it("returns the day number and uppercase short month", () => {
    const chip = eventChip("2026-05-30T12:00:00.000Z")
    expect(chip.day).toBe("30")
    expect(chip.month).toBe("MAY")
  })

  it("returns '--'/'--' for an unparseable input rather than throwing", () => {
    expect(eventChip("not a date")).toEqual({ day: "--", month: "--" })
  })
})

describe("dowLabel", () => {
  it("returns the short weekday for the local day", () => {
    // 2026-06-07 noon UTC is a Sunday in every real timezone offset.
    expect(dowLabel("2026-06-07T12:00:00.000Z")).toBe("Sun")
  })

  it("returns '' for an unparseable input", () => {
    expect(dowLabel("not a date")).toBe("")
  })
})

describe("timeLabel", () => {
  it("renders an hour:minute AM/PM clock for a valid instant", () => {
    // Don't pin the exact wall-clock time (it shifts with the machine TZ); assert the SHAPE.
    expect(timeLabel("2026-06-07T12:00:00.000Z")).toMatch(/^\d{1,2}:\d{2}\s?(AM|PM)$/)
  })

  it("returns '' for an unparseable input", () => {
    expect(timeLabel("not a date")).toBe("")
  })
})

const EN_DASH_RANGE = " – "

function localClock(hour: number, minute = 0): string {
  return new Date(2026, 5, 1, hour, minute, 0, 0).toISOString()
}

describe("timeRangeLabel", () => {
  it("drops the redundant meridiem when both ends share one in a 12-hour locale", () => {
    const out = timeRangeLabel(localClock(8), localClock(10), "en-US")
    expect(out).toBe(`8:00${EN_DASH_RANGE}${timeLabel(localClock(10), "en-US")}`)
    expect(out.match(/AM/g)).toHaveLength(1)
  })

  it("prints both meridiems when the range crosses noon", () => {
    const out = timeRangeLabel(localClock(11), localClock(13), "en-US")
    expect(out).toBe(
      `${timeLabel(localClock(11), "en-US")}${EN_DASH_RANGE}${timeLabel(localClock(13), "en-US")}`,
    )
    expect(out).toContain("AM")
    expect(out).toContain("PM")
  })

  it("prints both ends in full in a 24-hour locale", () => {
    expect(timeRangeLabel(localClock(8), localClock(10), "de-DE")).toBe(`8:00${EN_DASH_RANGE}10:00`)
    expect(timeRangeLabel(localClock(11), localClock(13), "de-DE")).toBe(
      `11:00${EN_DASH_RANGE}13:00`,
    )
  })

  it("keeps the meridiem on the leading end in a locale that writes it first", () => {
    const out = timeRangeLabel(localClock(8), localClock(10), "ko-KR")
    expect(out).toBe(`${timeLabel(localClock(8), "ko-KR")}${EN_DASH_RANGE}10:00`)
    expect(out.endsWith("10:00")).toBe(true)
  })

  it("returns '' for an unparseable end of the range rather than throwing", () => {
    expect(timeRangeLabel("not a date", localClock(10))).toBe("")
    expect(timeRangeLabel(localClock(8), "not a date")).toBe("")
  })
})

const LA = "America/Los_Angeles"
const DENVER = "America/Denver"
const HOUR_MS = 3_600_000

describe("zoneOffsetMs", () => {
  it("reads the summer and winter offsets of a DST zone", () => {
    expect(zoneOffsetMs(Date.parse("2026-07-01T12:00:00.000Z"), LA)).toBe(-7 * HOUR_MS)
    expect(zoneOffsetMs(Date.parse("2026-01-01T12:00:00.000Z"), LA)).toBe(-8 * HOUR_MS)
  })

  it("handles a half-hour zone and UTC", () => {
    expect(zoneOffsetMs(Date.parse("2026-07-01T12:00:00.000Z"), "Asia/Kolkata")).toBe(
      5.5 * HOUR_MS,
    )
    expect(zoneOffsetMs(Date.parse("2026-07-01T12:00:00.000Z"), "UTC")).toBe(0)
  })

  it("is 0 for an unknown zone instead of throwing", () => {
    expect(zoneOffsetMs(Date.parse("2026-07-01T12:00:00.000Z"), "Mars/Olympus")).toBe(0)
  })
})

describe("wallClockInZone", () => {
  it("reads the calendar day of the event zone, not of UTC", () => {
    expect(wallClockInZone(Date.parse("2026-09-06T05:00:00.000Z"), LA)).toEqual({
      year: 2026,
      month: 9,
      day: 5,
      hours: 22,
      minutes: 0,
    })
  })

  it("reads midnight as hour 0", () => {
    expect(wallClockInZone(Date.parse("2026-09-06T07:00:00.000Z"), LA).hours).toBe(0)
  })
})

describe("wallClockToInstantMs", () => {
  it("round-trips an unambiguous wall clock", () => {
    const wc = { year: 2026, month: 9, day: 5, hours: 13, minutes: 0 }
    expect(wallClockToInstantMs(wc, LA)).toBe(Date.parse("2026-09-05T20:00:00.000Z"))
    expect(wallClockExistsInZone(wc, LA)).toBe(true)
  })

  it("returns null for a wall clock the spring-forward gap skipped", () => {
    const gap = { year: 2026, month: 3, day: 8, hours: 2, minutes: 30 }
    expect(wallClockToInstantMs(gap, LA)).toBeNull()
    expect(wallClockExistsInZone(gap, LA)).toBe(false)
  })

  it("picks the EARLIER instant when the autumn fall-back duplicates a wall clock", () => {
    const ambiguous = { year: 2026, month: 11, day: 1, hours: 1, minutes: 30 }
    expect(wallClockInZone(Date.parse("2026-11-01T08:30:00.000Z"), LA)).toEqual(ambiguous)
    expect(wallClockInZone(Date.parse("2026-11-01T09:30:00.000Z"), LA)).toEqual(ambiguous)
    expect(wallClockToInstantMs(ambiguous, LA)).toBe(Date.parse("2026-11-01T08:30:00.000Z"))
  })
})

describe("zone identity helpers", () => {
  it("treats two spellings of one zone as the same offset and two real zones as different", () => {
    const at = Date.parse("2026-09-05T20:00:00.000Z")
    expect(sameOffsetAt(at, LA, "US/Pacific")).toBe(true)
    expect(sameOffsetAt(at, LA, "America/New_York")).toBe(false)
  })

  it("names the zone short form at an instant", () => {
    expect(zoneShortName(Date.parse("2026-09-05T20:00:00.000Z"), LA, "en-US")).toBe("PDT")
    expect(zoneShortName(Date.parse("2026-01-05T20:00:00.000Z"), LA, "en-US")).toBe("PST")
    expect(zoneShortName(Date.parse("2026-09-05T20:00:00.000Z"), "Mars/Olympus", "en-US")).toBe("")
  })

  it("validates zone ids and always offers the common fallback list", () => {
    expect(isValidTimeZone(LA)).toBe(true)
    expect(isValidTimeZone("Mars/Olympus")).toBe(false)
    expect(isValidTimeZone("")).toBe(false)
    expect(COMMON_TIMEZONES).toHaveLength(9)
    expect(COMMON_TIMEZONES[0]).toBe("UTC")
    for (const zone of COMMON_TIMEZONES) expect(isValidTimeZone(zone)).toBe(true)
    expect(supportedTimeZones()).toContain(LA)
  })
})

describe("formatters in an event zone", () => {
  const lateNight = "2026-09-06T05:00:00.000Z"

  it("chips the event zone's calendar day, not the viewer's", () => {
    expect(eventChip(lateNight, "en-US", LA)).toEqual({ day: "5", month: "SEP" })
    expect(eventChip(lateNight, "en-US", "UTC")).toEqual({ day: "6", month: "SEP" })
  })

  it("takes the weekday from the event zone", () => {
    expect(dowLabel(lateNight, undefined, LA)).toBe("Sat")
    expect(dowLabel(lateNight, undefined, "UTC")).toBe("Sun")
    expect(dowLabel(lateNight, ["do", "lu", "ma", "mi", "ju", "vi", "sa"], LA)).toBe("sa")
  })

  it("prints the clock and the range in the event zone", () => {
    expect(timeLabel("2026-09-05T20:00:00.000Z", "en-US", LA)).toBe("1:00 PM")
    expect(timeRangeLabel("2026-09-05T20:00:00.000Z", "2026-09-05T23:00:00.000Z", "en-US", LA)).toBe(
      `1:00${EN_DASH_RANGE}4:00 PM`,
    )
  })

  it("falls back to the viewer zone for an unknown zone rather than throwing", () => {
    const iso = "2026-09-05T20:00:00.000Z"
    expect(timeLabel(iso, "en-US", "Mars/Olympus")).toBe(timeLabel(iso, "en-US"))
    expect(dowLabel(iso, undefined, "Mars/Olympus")).toBe(dowLabel(iso))
    expect(eventChip(iso, "en-US", "Mars/Olympus")).toEqual(eventChip(iso, "en-US"))
  })
})

describe("eventWhenParts / eventWhenLabel", () => {
  const laEvent = {
    scheduledAt: "2026-09-05T20:00:00.000Z",
    endsAt: "2026-09-05T23:00:00.000Z",
    timezone: LA,
  }

  it("renders the event zone and suffixes it for a viewer on another offset", () => {
    expect(eventWhenParts(laEvent, { locale: "en-US", viewerTimeZone: DENVER })).toEqual({
      dow: "Sat",
      date: "Sep 5",
      time: "1:00 PM",
      range: `1:00${EN_DASH_RANGE}4:00 PM`,
      zone: "PDT",
    })
    expect(eventWhenLabel(laEvent, { locale: "en-US", viewerTimeZone: DENVER })).toBe(
      `Sat, Sep 5 · 1:00${EN_DASH_RANGE}4:00 PM PDT`,
    )
  })

  it("drops the suffix when the viewer sits at the same offset, however the zone is spelled", () => {
    expect(eventWhenParts(laEvent, { locale: "en-US", viewerTimeZone: LA }).zone).toBeNull()
    expect(eventWhenParts(laEvent, { locale: "en-US", viewerTimeZone: "US/Pacific" }).zone).toBeNull()
    expect(eventWhenLabel(laEvent, { locale: "en-US", viewerTimeZone: LA })).toBe(
      `Sat, Sep 5 · 1:00${EN_DASH_RANGE}4:00 PM`,
    )
  })

  it("prefixes the end weekday when the event runs past midnight in its own zone", () => {
    const overnight = {
      scheduledAt: "2026-09-06T05:00:00.000Z",
      endsAt: "2026-09-06T09:00:00.000Z",
      timezone: LA,
    }
    expect(eventWhenLabel(overnight, { locale: "en-US", viewerTimeZone: DENVER })).toBe(
      `Sat, Sep 5 · 10:00 PM${EN_DASH_RANGE}Sun 2:00 AM PDT`,
    )
  })

  it("falls back to the start time alone when the event has no end", () => {
    const open = { scheduledAt: "2026-09-05T20:00:00.000Z", timezone: LA }
    const parts = eventWhenParts(open, { locale: "en-US", viewerTimeZone: DENVER })
    expect(parts.range).toBeNull()
    expect(eventWhenLabel(open, { locale: "en-US", viewerTimeZone: DENVER })).toBe(
      "Sat, Sep 5 · 1:00 PM PDT",
    )
  })

  it("renders a legacy zone-less row in the viewer's own zone with no suffix", () => {
    const legacy = { scheduledAt: "2026-09-05T20:00:00.000Z", endsAt: "2026-09-05T23:00:00.000Z" }
    const parts = eventWhenParts(legacy, { locale: "en-US", viewerTimeZone: DENVER })
    expect(parts.zone).toBeNull()
    expect(parts.range).toBe(
      timeRangeLabel(legacy.scheduledAt, legacy.endsAt ?? "", "en-US"),
    )
  })

  it("returns empty parts for an unparseable instant rather than throwing", () => {
    expect(eventWhenParts({ scheduledAt: "not a date" })).toEqual({
      dow: "",
      date: "",
      time: "",
      range: null,
      zone: null,
    })
    expect(eventWhenLabel({ scheduledAt: "not a date" })).toBe("")
  })
})
