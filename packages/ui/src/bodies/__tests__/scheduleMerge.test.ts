process.env.TZ = "America/Los_Angeles"

import { describe, expect, it } from "vitest"
import {
  DURATION_CHIP_HOURS,
  PAST_SCHEDULE_GRACE_MS,
  durationChipFor,
  endOffsetMs,
  endTimeAfter,
  eventDurationMs,
  isScheduleInFutureInZone,
  isScheduleUntouched,
  mergeDateTime,
} from "../calendarModel"

const SPRING_FORWARD_DAY = () => new Date(2026, 2, 8)
const FALL_BACK_DAY = () => new Date(2026, 10, 1)
const NORMAL_DAY = () => new Date(2026, 6, 24)

const timeOn = (base: Date, hours: number, minutes: number) => {
  const t = new Date(base)
  t.setHours(hours, minutes, 0, 0)
  return t
}

describe("mergeDateTime (this file pins process.env.TZ=America/Los_Angeles before imports; every DST assertion depends on it)", () => {
  it("merges a normal day + time into that day's wall clock with seconds and ms zeroed", () => {
    const date = new Date(2026, 6, 24, 9, 15, 44, 321)
    const time = timeOn(new Date(2026, 0, 15), 14, 30)
    const merged = mergeDateTime(date, time)
    expect([merged.getFullYear(), merged.getMonth(), merged.getDate()]).toEqual([2026, 6, 24])
    expect([merged.getHours(), merged.getMinutes(), merged.getSeconds(), merged.getMilliseconds()]).toEqual([
      14, 30, 0, 0,
    ])
  })

  it("does not mutate either input", () => {
    const date = new Date(2026, 6, 24, 9, 15)
    const time = timeOn(new Date(2026, 0, 15), 14, 30)
    const dateMs = date.getTime()
    const timeMs = time.getTime()
    mergeDateTime(date, time)
    expect(date.getTime()).toBe(dateMs)
    expect(time.getTime()).toBe(timeMs)
  })

  it("keeps a midnight pick on the chosen day", () => {
    const merged = mergeDateTime(NORMAL_DAY(), timeOn(new Date(2026, 0, 15), 0, 0))
    expect([merged.getDate(), merged.getHours(), merged.getMinutes()]).toEqual([24, 0, 0])
  })

  it("spring-forward: a 2:00 AM pick anchored on a normal day lands at 3:00 AM PDT on Mar 8 2026 (the GAP-1 divergence)", () => {
    const time = timeOn(new Date(2026, 0, 15), 2, 0)
    const merged = mergeDateTime(SPRING_FORWARD_DAY(), time)
    expect(time.getHours()).toBe(2)
    expect(merged.getHours()).toBe(3)
    expect(merged.toISOString()).toBe("2026-03-08T10:00:00.000Z")
  })

  it("spring-forward: re-anchoring the time onto the picked day makes label and instant agree and is idempotent", () => {
    const time = timeOn(new Date(2026, 0, 15), 2, 0)
    const reanchored = mergeDateTime(SPRING_FORWARD_DAY(), time)
    expect(reanchored.getHours()).toBe(3)
    const remerged = mergeDateTime(SPRING_FORWARD_DAY(), reanchored)
    expect(remerged.getTime()).toBe(reanchored.getTime())
  })

  it("fall-back: an ambiguous 1:30 AM on Nov 1 2026 resolves to the FIRST occurrence (PDT, 08:30Z)", () => {
    const merged = mergeDateTime(FALL_BACK_DAY(), timeOn(new Date(2026, 0, 15), 1, 30))
    expect(merged.getHours()).toBe(1)
    expect(merged.getMinutes()).toBe(30)
    expect(merged.toISOString()).toBe("2026-11-01T08:30:00.000Z")
    expect(mergeDateTime(FALL_BACK_DAY(), merged).getTime()).toBe(merged.getTime())
  })

  it("fall-back: re-merging an instant stored at the SECOND 1:30 AM occurrence shifts it 1h earlier (why GAP-2 must bypass the merge when untouched)", () => {
    const secondOccurrence = new Date("2026-11-01T09:30:00.000Z")
    const remerged = mergeDateTime(secondOccurrence, secondOccurrence)
    expect(remerged.getTime()).toBe(secondOccurrence.getTime() - 3_600_000)
  })
})

describe("isScheduleUntouched (the edit body's no-op-save guard)", () => {
  const ORIGINAL_ISO = "2026-11-01T09:30:00.000Z"

  it("reports untouched when date and time still equal the prefilled scheduledAt instant", () => {
    const when = new Date(ORIGINAL_ISO)
    expect(isScheduleUntouched(ORIGINAL_ISO, when, when)).toBe(true)
  })

  it("title-only edit on an ambiguous-hour event round-trips the ORIGINAL iso instead of the 1h-shifted merge", () => {
    const when = new Date(ORIGINAL_ISO)
    const untouched = isScheduleUntouched(ORIGINAL_ISO, when, when)
    const sent = untouched ? ORIGINAL_ISO : mergeDateTime(when, when).toISOString()
    expect(sent).toBe(ORIGINAL_ISO)
    expect(mergeDateTime(when, when).toISOString()).not.toBe(ORIGINAL_ISO)
  })

  it("reports touched once the time moves off the original instant", () => {
    const when = new Date(ORIGINAL_ISO)
    const moved = timeOn(when, 9, 0)
    expect(isScheduleUntouched(ORIGINAL_ISO, when, moved)).toBe(false)
  })

  it("reports touched once the date moves off the original instant", () => {
    const when = new Date(ORIGINAL_ISO)
    const moved = new Date(when)
    moved.setFullYear(2026, 10, 2)
    expect(isScheduleUntouched(ORIGINAL_ISO, moved, when)).toBe(false)
  })
})

describe("isScheduleInFutureInZone (publish gate)", () => {
  const NOW = timeOn(NORMAL_DAY(), 12, 0)
  const ZONE = "America/Los_Angeles"

  it("rejects a past instant", () => {
    expect(isScheduleInFutureInZone(NORMAL_DAY(), timeOn(NORMAL_DAY(), 9, 0), ZONE, NOW.getTime())).toBe(false)
  })

  it("accepts a future instant", () => {
    expect(isScheduleInFutureInZone(NORMAL_DAY(), timeOn(NORMAL_DAY(), 12, 30), ZONE, NOW.getTime())).toBe(true)
  })

  it("accepts an instant inside the grace window so a pick seconds before the minute rolls does not flap", () => {
    const now = timeOn(NORMAL_DAY(), 12, 0).getTime() + PAST_SCHEDULE_GRACE_MS - 1_000
    expect(isScheduleInFutureInZone(NORMAL_DAY(), timeOn(NORMAL_DAY(), 12, 0), ZONE, now)).toBe(true)
  })
})

describe("durationChipFor across the spring-forward gap", () => {
  const CHIP_MS = 3_600_000

  it("lights the chip the host actually tapped, not the one the wall clock suggests", () => {
    const day = SPRING_FORWARD_DAY()
    const start = timeOn(day, 1, 30)
    const end = endTimeAfter(day, start, 1 * CHIP_MS)
    expect([end.getHours(), end.getMinutes()]).toEqual([3, 30])
    expect(eventDurationMs(day, start, end)).toBe(1 * CHIP_MS)
    expect(endOffsetMs(start, end)).toBe(2 * CHIP_MS)
    expect(durationChipFor(day, start, end)).toBe(1)
  })

  it("collapses the 1 h and 2 h chips onto the same instant, and says so honestly", () => {
    const day = SPRING_FORWARD_DAY()
    const start = timeOn(day, 1, 30)
    const oneHour = endTimeAfter(day, start, 1 * CHIP_MS)
    const twoHours = endTimeAfter(day, start, 2 * CHIP_MS)
    expect(twoHours.getTime()).toBe(oneHour.getTime())
    expect(durationChipFor(day, start, twoHours)).toBe(1)
    expect(durationChipFor(day, start, endTimeAfter(day, start, 3 * CHIP_MS))).toBe(2)
  })

  it("leaves a start clear of the gap alone on the same day", () => {
    const day = SPRING_FORWARD_DAY()
    const start = timeOn(day, 9, 0)
    for (const hours of DURATION_CHIP_HOURS) {
      expect(durationChipFor(day, start, endTimeAfter(day, start, hours * CHIP_MS))).toBe(hours)
    }
  })

  it("lights every chip on a normal day", () => {
    const day = NORMAL_DAY()
    const start = timeOn(day, 9, 0)
    for (const hours of DURATION_CHIP_HOURS) {
      const end = endTimeAfter(day, start, hours * CHIP_MS)
      expect(eventDurationMs(day, start, end)).toBe(hours * CHIP_MS)
      expect(durationChipFor(day, start, end)).toBe(hours)
    }
  })
})
