import { describe, expect, it } from "vitest"
import {
  monthGrid,
  rotateWeekdays,
  sameDay,
  startOfDay,
  timeSlots,
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
