import { describe, expect, it } from "vitest"
import {
  PAST_SCHEDULE_GRACE_MS,
  endOffsetMs,
  endTimeAfter,
  endsNextDay,
  formWallClock,
  isScheduleInFuture,
  isScheduleInFutureInZone,
  isScheduleUntouched,
  isTimeSlotSelectable,
  monthGrid,
  uses24HourClock,
  wallClockExistsOn,
  wallClockToFormDate,
  weekStartForLocale,
  zoneDisplayName,
} from "../calendarModel"

// A mid-July day is outside every common DST transition, so these device-local assertions hold in any
// developer's zone.
const DAY = new Date(2026, 6, 24)
const at = (h: number, m = 0) => new Date(2026, 6, 24, h, m, 0, 0)
const clock = (h: number, m = 0) => new Date(2000, 0, 1, h, m, 0, 0)

describe("wall-clock helpers", () => {
  it("round-trips a form day and clock through a wall clock", () => {
    const wall = formWallClock(DAY, clock(13, 45))
    expect(wall).toEqual({ year: 2026, month: 7, day: 24, hours: 13, minutes: 45 })
    expect(wallClockToFormDate(wall).getTime()).toBe(at(13, 45).getTime())
  })

  it("drops seconds from the typed clock", () => {
    expect(formWallClock(DAY, new Date(2000, 0, 1, 9, 5, 59, 999))).toMatchObject({ hours: 9, minutes: 5 })
  })

  it("says an ordinary clock exists on an ordinary day", () => {
    expect(wallClockExistsOn(DAY, 2, 30)).toBe(true)
    expect(wallClockExistsOn(DAY, 23, 30)).toBe(true)
  })
})

describe("isTimeSlotSelectable", () => {
  it("allows every slot before a day is chosen", () => {
    expect(isTimeSlotSelectable(null, 0, 0, at(12))).toBe(true)
  })

  it("keeps a slot selectable for the one-minute grace after it passes", () => {
    const now = at(12)
    expect(isTimeSlotSelectable(DAY, 12, 0, now)).toBe(true)
    expect(isTimeSlotSelectable(DAY, 11, 30, now)).toBe(false)
    expect(isTimeSlotSelectable(DAY, 12, 0, new Date(now.getTime() + PAST_SCHEDULE_GRACE_MS - 1))).toBe(true)
    expect(isTimeSlotSelectable(DAY, 12, 0, new Date(now.getTime() + PAST_SCHEDULE_GRACE_MS))).toBe(false)
  })
})

describe("isScheduleInFuture grace", () => {
  it("accepts a start up to one minute in the past and refuses one at the grace edge", () => {
    expect(PAST_SCHEDULE_GRACE_MS).toBe(60_000)
    const start = at(10)
    expect(isScheduleInFuture(DAY, clock(10), new Date(start.getTime() + 59_999))).toBe(true)
    expect(isScheduleInFuture(DAY, clock(10), new Date(start.getTime() + 60_000))).toBe(false)
  })

  it("applies the same grace in an explicit zone", () => {
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

describe("monthGrid edges", () => {
  it("lays out a leap-year February", () => {
    const grid = monthGrid(2028, 1)
    expect(grid.filter((cell) => cell !== null)).toHaveLength(29)
    expect(grid.length % 7).toBe(0)
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

  it("starts the week on Monday for British English", () => {
    expect(weekStartForLocale("en-GB")).toBe(1)
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
