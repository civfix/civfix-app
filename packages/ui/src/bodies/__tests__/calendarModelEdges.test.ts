import { describe, expect, it } from "vitest"
import {
  PAST_SCHEDULE_GRACE_MS,
  endOffsetMs,
  endTimeAfter,
  endsNextDay,
  formInstantMs,
  isScheduleInFutureInZone,
  isScheduleUntouched,
  uses24HourClock,
  wallClockToFormDate,
  zoneDisplayName,
} from "../calendarModel"

// A mid-July day is outside every common DST transition, so these device-local assertions hold in any
// developer's zone.
const DAY = new Date(2026, 6, 24)
const at = (h: number, m = 0) => new Date(2026, 6, 24, h, m, 0, 0)
const clock = (h: number, m = 0) => new Date(2000, 0, 1, h, m, 0, 0)

describe("wall-clock helpers", () => {
  it("maps a wall clock onto the device-local form date", () => {
    const wall = { year: 2026, month: 7, day: 24, hours: 13, minutes: 45 }
    expect(wallClockToFormDate(wall).getTime()).toBe(at(13, 45).getTime())
  })

  it("drops seconds from the typed clock", () => {
    expect(formInstantMs(DAY, new Date(2000, 0, 1, 9, 5, 59, 999), "UTC")).toBe(Date.UTC(2026, 6, 24, 9, 5))
  })
})

describe("isScheduleInFutureInZone grace", () => {
  it("accepts a start up to one minute in the past and refuses one at the grace edge", () => {
    expect(PAST_SCHEDULE_GRACE_MS).toBe(60_000)
    const startUtc = Date.parse("2026-07-24T10:00:00.000Z")
    expect(isScheduleInFutureInZone(DAY, clock(10), "UTC", startUtc + 59_999)).toBe(true)
    expect(isScheduleInFutureInZone(DAY, clock(10), "UTC", startUtc + 60_000)).toBe(false)
  })

  it("is false in a zone where the wall clock does not exist", () => {
    const springForward = new Date(2026, 2, 8, 12)
    expect(isScheduleInFutureInZone(springForward, clock(2, 30), "America/Los_Angeles", 0)).toBe(false)
  })
})

describe("isScheduleUntouched", () => {
  it("is false for an unparseable original", () => {
    expect(isScheduleUntouched("not-a-date", DAY, clock(10), "UTC")).toBe(false)
    expect(isScheduleUntouched("not-a-date", DAY, clock(10))).toBe(false)
  })

  it("ignores the seconds of the stored instant in a zone", () => {
    expect(isScheduleUntouched("2026-07-24T10:00:42.500Z", DAY, clock(10), "UTC")).toBe(true)
  })

  it("compares both raw instants without a zone", () => {
    const iso = at(10).toISOString()
    expect(isScheduleUntouched(iso, at(10), at(10))).toBe(true)
    expect(isScheduleUntouched(iso, DAY, at(10))).toBe(false)
  })
})

describe("end clock arithmetic", () => {
  it("measures the clock offset forward around midnight", () => {
    expect(endOffsetMs(clock(22), clock(1))).toBe(3 * 3_600_000)
    expect(endOffsetMs(clock(9), clock(9))).toBe(0)
  })

  it("treats an equal end clock as the next day", () => {
    expect(endsNextDay(clock(9), clock(9))).toBe(true)
    expect(endsNextDay(clock(9), clock(9, 1))).toBe(false)
  })

  it("puts an offset end on the form day's clock, wrapping past midnight onto the same day", () => {
    const end = endTimeAfter(DAY, clock(23), 2 * 3_600_000)
    expect([end.getFullYear(), end.getMonth(), end.getDate(), end.getHours(), end.getMinutes()]).toEqual([
      2026, 6, 24, 1, 0,
    ])
  })
})

describe("locale clock conventions", () => {
  it("reads 12-hour for US English and Korean, 24-hour for German and Spanish", () => {
    expect(uses24HourClock("en-US")).toBe(false)
    expect(uses24HourClock("ko-KR")).toBe(false)
    expect(uses24HourClock("de-DE")).toBe(true)
    expect(uses24HourClock("es-ES")).toBe(true)
  })

  it("falls back to 12-hour for an invalid locale tag", () => {
    expect(uses24HourClock("!!bad")).toBe(false)
  })
})

describe("zoneDisplayName", () => {
  const JULY = Date.parse("2026-07-01T12:00:00.000Z")
  const JANUARY = Date.parse("2026-01-15T12:00:00.000Z")

  it("pairs the long name with the short one, following DST at the given instant", () => {
    expect(zoneDisplayName("America/Los_Angeles", "en-US", JULY)).toBe("Pacific Daylight Time (PDT)")
    expect(zoneDisplayName("America/Los_Angeles", "en-US", JANUARY)).toBe("Pacific Standard Time (PST)")
  })

  it("falls back to a GMT offset short name where no abbreviation exists", () => {
    expect(zoneDisplayName("Asia/Kolkata", "en-US", JULY)).toBe("India Standard Time (GMT+5:30)")
  })

  it("returns the raw id for a zone Intl cannot resolve", () => {
    expect(zoneDisplayName("Mars/Olympus", "en-US", JULY)).toBe("Mars/Olympus")
  })
})
