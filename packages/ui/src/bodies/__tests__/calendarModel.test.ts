import { describe, expect, it } from "vitest"
import {
  addWallClockDays,
  DURATION_CHIP_HOURS,
  durationChipFor,
  endOffsetMs,
  endsNextDay,
  endTimeAfter,
  endTimeSelectable,
  eventDurationMs,
  eventWindowInZone,
  eventWindowOf,
  formEndInstantMs,
  formInstantMs,
  isScheduleUntouched,
  MAX_EVENT_DURATION_MS,
  nowClockInZone,
  mergeDateTime,
  monthGrid,
  resolveEventEnd,
  rotateWeekdays,
  sameDay,
  scheduleFieldErrors,
  startOfDay,
  timeSlots,
  todayInZone,
  weekStartForLocale,
} from "../calendarModel"

const SUNDAY_FIRST = ["S", "M", "T", "W", "T", "F", "S"] as const

describe("calendarModel", () => {
  it("zeroes the clock without mutating the input", () => {
    const source = new Date(2026, 6, 24, 13, 45, 30, 500)
    const day = startOfDay(source)
    expect([day.getHours(), day.getMinutes(), day.getSeconds(), day.getMilliseconds()]).toEqual([0, 0, 0, 0])
    expect(source.getHours()).toBe(13)
  })

  it("compares calendar days, not timestamps", () => {
    expect(sameDay(new Date(2026, 6, 24, 1), new Date(2026, 6, 24, 23))).toBe(true)
    expect(sameDay(new Date(2026, 6, 24), new Date(2026, 6, 25))).toBe(false)
  })

  it("pads a Sunday-first month grid to whole weeks", () => {
    // 1 Jul 2026 is a Wednesday -> 3 leading pads, 31 days, padded out to 5 weeks.
    const grid = monthGrid(2026, 6)
    expect(grid.slice(0, 4)).toEqual([null, null, null, 1])
    expect(grid.length % 7).toBe(0)
    expect(grid.filter((d) => d !== null)).toHaveLength(31)
  })

  it("re-pads the grid when the week starts on Monday", () => {
    // Same month, Monday-first: Wednesday is column 2, so only 2 leading pads.
    const grid = monthGrid(2026, 6, 1)
    expect(grid.slice(0, 3)).toEqual([null, null, 1])
    expect(grid.length % 7).toBe(0)
  })

  it("pads a month that starts exactly on the week start with no leading cells", () => {
    // 1 Feb 2026 is a Sunday.
    expect(monthGrid(2026, 1)[0]).toBe(1)
  })

  it("rotates the weekday initials in step with the week start", () => {
    expect(rotateWeekdays(SUNDAY_FIRST, 0)).toEqual(["S", "M", "T", "W", "T", "F", "S"])
    expect(rotateWeekdays(SUNDAY_FIRST, 1)).toEqual(["M", "T", "W", "T", "F", "S", "S"])
  })

  it("leaves a malformed initials array alone", () => {
    expect(rotateWeekdays(["M", "T"], 1)).toEqual(["M", "T"])
  })

  it("resolves the locale week start (Sunday for en/ko, Monday for es/de)", () => {
    expect(weekStartForLocale("en-US")).toBe(0)
    expect(weekStartForLocale("ko")).toBe(0)
    expect(weekStartForLocale("es")).toBe(1)
    expect(weekStartForLocale("de-DE")).toBe(1)
  })

  it("falls back to Sunday for an unresolvable locale", () => {
    expect(weekStartForLocale("!!not-a-locale")).toBe(0)
  })

  it("builds 48 slots with stable, unique keys", () => {
    const slots = timeSlots("en-US")
    expect(slots).toHaveLength(48)
    expect(new Set(slots.map((s) => s.key)).size).toBe(48)
    expect(slots[0]).toMatchObject({ key: "0:0", hours: 0, minutes: 0 })
    expect(slots[47]).toMatchObject({ key: "23:30", hours: 23, minutes: 30 })
  })

  it("keys slots independently of the label so a DST spring-forward day cannot collide", () => {
    // US spring-forward (2:00-2:59 AM does not exist on 8 Mar 2026) used to normalize 2:00/2:30 to
    // 3:00/3:30, duplicating both the label and the React key. Labels now come off a fixed base date.
    const slots = timeSlots("en-US")
    const twoAm = slots.find((s) => s.hours === 2 && s.minutes === 0)
    const threeAm = slots.find((s) => s.hours === 3 && s.minutes === 0)
    expect(twoAm?.key).not.toBe(threeAm?.key)
    expect(new Set(slots.map((s) => s.label)).size).toBe(48)
  })
})

describe("the event's end time", () => {
  const day = new Date(2026, 6, 24)
  const nineAm = new Date(2026, 6, 24, 9, 0, 0, 0)
  const lateNight = new Date(2026, 6, 24, 23, 30, 0, 0)

  it("offers only clock times at least the slot minimum after the start", () => {
    expect(endTimeSelectable(day, nineAm, 9, 0)).toBe(false)
    expect(endTimeSelectable(day, nineAm, 9, 10)).toBe(false)
    expect(endTimeSelectable(day, nineAm, 9, 15)).toBe(true)
    expect(endTimeSelectable(day, nineAm, 11, 0)).toBe(true)
  })

  it("reads a clock at or before the start as the NEXT day, not as an impossible end", () => {
    expect(endTimeSelectable(day, nineAm, 8, 30)).toBe(true)
    expect(endsNextDay(nineAm, new Date(2026, 6, 24, 8, 30))).toBe(true)
    expect(endOffsetMs(nineAm, new Date(2026, 6, 24, 8, 30))).toBe(23.5 * 3_600_000)
  })

  it("leaves a 23:30 start a full grid of ends instead of none", () => {
    const offered = timeSlots("en-US").filter((slot) =>
      endTimeSelectable(day, lateNight, slot.hours, slot.minutes),
    )
    expect(offered.length).toBe(47)
    expect(endTimeSelectable(day, lateNight, 2, 0)).toBe(true)
    expect(endTimeSelectable(day, lateNight, 23, 30)).toBe(false)
  })

  it("resolves an end clock that rolled over onto the following calendar day", () => {
    const end = resolveEventEnd(day, lateNight, new Date(2026, 0, 1, 2, 0))
    expect(end.getDate()).toBe(25)
    expect(end.getHours()).toBe(2)
    expect(end.getTime() - mergeDateTime(day, lateNight).getTime()).toBe(2.5 * 3_600_000)
  })

  it("never lets the end reach a full day past the start", () => {
    expect(MAX_EVENT_DURATION_MS).toBe(24 * 3_600_000)
    for (const slot of timeSlots("en-US")) {
      const offset = endOffsetMs(nineAm, new Date(2026, 6, 24, slot.hours, slot.minutes))
      expect(offset).toBeLessThan(MAX_EVENT_DURATION_MS)
    }
  })

  it("offers nothing at all until a day and a start time exist", () => {
    expect(endTimeSelectable(null, nineAm, 11, 0)).toBe(false)
    expect(endTimeSelectable(day, null, 11, 0)).toBe(false)
  })
})

describe("the duration chips", () => {
  const day = new Date(2026, 6, 24)

  it("writes a valid end from ANY start, including one that rolls past midnight", () => {
    const tenPm = new Date(2026, 6, 24, 22, 0, 0, 0)
    const end = endTimeAfter(day, tenPm, 4 * 3_600_000)
    expect(end.getHours()).toBe(2)
    expect(end.getMinutes()).toBe(0)
    expect(endTimeSelectable(day, tenPm, end.getHours(), end.getMinutes())).toBe(true)
    expect(durationChipFor(day, tenPm, end)).toBe(4)
    const window = eventWindowOf(day, tenPm, end)
    expect(window?.end?.getDate()).toBe(25)
    expect((window?.end?.getTime() ?? 0) - (window?.start.getTime() ?? 0)).toBe(4 * 3_600_000)
  })

  it("keeps every chip reachable from a 23:30 start", () => {
    const lateNight = new Date(2026, 6, 24, 23, 30, 0, 0)
    for (const hours of DURATION_CHIP_HOURS) {
      const end = endTimeAfter(day, lateNight, hours * 3_600_000)
      expect(endTimeSelectable(day, lateNight, end.getHours(), end.getMinutes())).toBe(true)
      expect(durationChipFor(day, lateNight, end)).toBe(hours)
    }
  })
})

describe("durationChipFor", () => {
  const day = new Date(2026, 6, 24)
  const start = new Date(2026, 6, 24, 9, 0, 0, 0)
  const plus = (hours: number, minutes = 0) =>
    new Date(start.getTime() + hours * 3_600_000 + minutes * 60_000)

  it("lights the chip whose length matches the window exactly", () => {
    for (const hours of DURATION_CHIP_HOURS) {
      expect(durationChipFor(day, start, plus(hours))).toBe(hours)
    }
  })

  it("lights no chip for an off-grid, zero or negative length", () => {
    expect(durationChipFor(day, start, plus(2, 30))).toBeNull()
    expect(durationChipFor(day, start, plus(5))).toBeNull()
    expect(durationChipFor(day, start, start)).toBeNull()
    expect(durationChipFor(day, start, plus(-1))).toBeNull()
    expect(durationChipFor(null, start, plus(2))).toBeNull()
    expect(durationChipFor(day, null, plus(2))).toBeNull()
    expect(durationChipFor(day, start, null)).toBeNull()
  })

  it("measures the REAL elapsed time, so a chip cannot light on a clock offset alone", () => {
    expect(eventDurationMs(day, start, plus(3))).toBe(3 * 3_600_000)
  })
})

describe("eventWindowOf", () => {
  const day = new Date(2026, 6, 24)
  const nineAm = new Date(2026, 0, 1, 9, 0, 0, 0)
  const elevenAm = new Date(2026, 0, 1, 11, 0, 0, 0)

  it("merges the clock times onto the chosen DAY, not onto their own base dates", () => {
    const window = eventWindowOf(day, nineAm, elevenAm)
    expect(window?.start.getDate()).toBe(24)
    expect(window?.start.getHours()).toBe(9)
    expect(window?.end?.getDate()).toBe(24)
    expect(window?.end?.getHours()).toBe(11)
  })

  it("rolls an end clock at or before the start onto the next day", () => {
    const lateNight = new Date(2026, 0, 1, 23, 30, 0, 0)
    const twoAm = new Date(2026, 0, 1, 2, 0, 0, 0)
    const window = eventWindowOf(day, lateNight, twoAm)
    expect(window?.start.getDate()).toBe(24)
    expect(window?.end?.getDate()).toBe(25)
    expect(window?.end?.getHours()).toBe(2)
  })

  it("is null without a day and a start, and end-less without an end time", () => {
    expect(eventWindowOf(null, nineAm, elevenAm)).toBeNull()
    expect(eventWindowOf(day, null, elevenAm)).toBeNull()
    expect(eventWindowOf(day, nineAm, null)?.end).toBeNull()
  })
})

describe("the form's wall clocks resolve in the EVENT's zone", () => {
  const LA = "America/Los_Angeles"
  const NY = "America/New_York"

  const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0, 0)
  const clock = (h: number, mi = 0) => new Date(2026, 0, 1, h, mi, 0, 0)

  it("reads the same typed clock as a different instant in a different zone", () => {
    const at = day(2026, 9, 5)
    expect(new Date(formInstantMs(at, clock(13), LA) ?? 0).toISOString()).toBe(
      "2026-09-05T20:00:00.000Z",
    )
    expect(new Date(formInstantMs(at, clock(13), NY) ?? 0).toISOString()).toBe(
      "2026-09-05T17:00:00.000Z",
    )
  })

  it("rolls an end clock at or before the start onto the next day in the event zone", () => {
    const at = day(2026, 9, 5)
    const end = formEndInstantMs(at, clock(22), clock(2), NY)
    expect(new Date(end ?? 0).toISOString()).toBe("2026-09-06T06:00:00.000Z")
  })

  it("refuses a wall clock that the spring-forward jump deletes", () => {
    const springForward = day(2026, 3, 8)
    expect(formInstantMs(springForward, clock(2, 30), LA)).toBeNull()
    expect(
      scheduleFieldErrors(
        { date: springForward, time: clock(2, 30), endTime: null },
        LA,
        Date.parse("2026-03-01T00:00:00.000Z"),
      ),
    ).toEqual({ time: "time_dst_gap" })
  })

  it("flags a past date and a passed clock against the EVENT zone's today", () => {
    const now = Date.parse("2026-09-05T20:00:00.000Z")
    expect(
      scheduleFieldErrors({ date: day(2026, 9, 4), time: clock(13), endTime: null }, LA, now).date,
    ).toBe("date_past")
    expect(
      scheduleFieldErrors({ date: day(2026, 9, 5), time: clock(9), endTime: null }, LA, now).time,
    ).toBe("time_past")
    expect(
      scheduleFieldErrors({ date: day(2026, 9, 5), time: clock(14), endTime: null }, LA, now),
    ).toEqual({})
  })

  it("flags an end that lands under the 15-minute floor", () => {
    const now = Date.parse("2026-09-05T00:00:00.000Z")
    const at = day(2026, 9, 5)
    expect(
      scheduleFieldErrors({ date: at, time: clock(13), endTime: clock(13, 10) }, LA, now).endTime,
    ).toBe("end_too_soon")
    expect(
      scheduleFieldErrors({ date: at, time: clock(13), endTime: clock(16) }, LA, now).endTime,
    ).toBeUndefined()
  })

  it("puts today and now on the event zone's calendar, not the device's", () => {
    const now = Date.parse("2026-09-06T04:00:00.000Z")
    expect(todayInZone(LA, now).getDate()).toBe(5)
    expect(todayInZone(NY, now).getDate()).toBe(6)
    expect(nowClockInZone(NY, now).getHours()).toBe(0)
  })

  it("adds calendar days to a wall clock without letting an offset shift drag the hour", () => {
    expect(addWallClockDays({ year: 2026, month: 3, day: 6, hours: 10, minutes: 30 }, 7)).toEqual({
      year: 2026,
      month: 3,
      day: 13,
      hours: 10,
      minutes: 30,
    })
  })

  it("carries the event window's instants in the event zone", () => {
    const window = eventWindowInZone(day(2026, 9, 5), clock(13), clock(16), NY)
    expect(window?.start.toISOString()).toBe("2026-09-05T17:00:00.000Z")
    expect(window?.end?.toISOString()).toBe("2026-09-05T20:00:00.000Z")
  })

  it("compares an edited schedule against the stored instant, not the device clock", () => {
    expect(isScheduleUntouched("2026-09-05T17:00:00.000Z", day(2026, 9, 5), clock(13), NY)).toBe(true)
    expect(isScheduleUntouched("2026-09-05T17:00:00.000Z", day(2026, 9, 5), clock(14), NY)).toBe(false)
  })
})
