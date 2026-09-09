process.env.TZ = "America/Los_Angeles"

import { describe, expect, it } from "vitest"
import {
  PAST_SCHEDULE_GRACE_MS,
  isScheduleInFuture,
  isScheduleUntouched,
  isTimeSlotSelectable,
  mergeDateTime,
  wallClockExistsOn,
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

describe("wallClockExistsOn", () => {
  it("rejects the nonexistent 2:00/2:30 AM hour on the spring-forward day", () => {
    expect(wallClockExistsOn(SPRING_FORWARD_DAY(), 2, 0)).toBe(false)
    expect(wallClockExistsOn(SPRING_FORWARD_DAY(), 2, 30)).toBe(false)
  })

  it("accepts the hours around the spring-forward gap", () => {
    expect(wallClockExistsOn(SPRING_FORWARD_DAY(), 1, 30)).toBe(true)
    expect(wallClockExistsOn(SPRING_FORWARD_DAY(), 3, 0)).toBe(true)
  })

  it("accepts the ambiguous (repeated) fall-back hour", () => {
    expect(wallClockExistsOn(FALL_BACK_DAY(), 1, 30)).toBe(true)
  })

  it("accepts every slot on a normal day", () => {
    expect(wallClockExistsOn(NORMAL_DAY(), 2, 0)).toBe(true)
    expect(wallClockExistsOn(NORMAL_DAY(), 0, 0)).toBe(true)
  })
})

describe("isTimeSlotSelectable (chip gating)", () => {
  const NOON = timeOn(NORMAL_DAY(), 12, 0)

  it("keeps every chip selectable while no date is picked", () => {
    expect(isTimeSlotSelectable(null, 2, 0, NOON)).toBe(true)
  })

  it("disables the nonexistent spring-forward chips on Mar 8 2026", () => {
    const now = timeOn(new Date(2026, 2, 1), 12, 0)
    expect(isTimeSlotSelectable(SPRING_FORWARD_DAY(), 2, 0, now)).toBe(false)
    expect(isTimeSlotSelectable(SPRING_FORWARD_DAY(), 2, 30, now)).toBe(false)
    expect(isTimeSlotSelectable(SPRING_FORWARD_DAY(), 3, 0, now)).toBe(true)
  })

  it("disables elapsed chips when the picked date is today", () => {
    expect(isTimeSlotSelectable(NORMAL_DAY(), 10, 0, NOON)).toBe(false)
    expect(isTimeSlotSelectable(NORMAL_DAY(), 14, 0, NOON)).toBe(true)
  })

  it("keeps the just-elapsed chip selectable within the grace window", () => {
    const justPast = new Date(timeOn(NORMAL_DAY(), 12, 0).getTime() + PAST_SCHEDULE_GRACE_MS - 1_000)
    expect(isTimeSlotSelectable(NORMAL_DAY(), 12, 0, justPast)).toBe(true)
    const beyondGrace = new Date(timeOn(NORMAL_DAY(), 12, 0).getTime() + PAST_SCHEDULE_GRACE_MS + 1_000)
    expect(isTimeSlotSelectable(NORMAL_DAY(), 12, 0, beyondGrace)).toBe(false)
  })

  it("disables every chip on a fully past day", () => {
    const now = timeOn(new Date(2026, 6, 25), 9, 0)
    expect(isTimeSlotSelectable(NORMAL_DAY(), 23, 30, now)).toBe(false)
  })
})

describe("isScheduleInFuture (publish gate)", () => {
  const NOW = timeOn(NORMAL_DAY(), 12, 0)

  it("rejects a past instant", () => {
    expect(isScheduleInFuture(NORMAL_DAY(), timeOn(NORMAL_DAY(), 9, 0), NOW)).toBe(false)
  })

  it("accepts a future instant", () => {
    expect(isScheduleInFuture(NORMAL_DAY(), timeOn(NORMAL_DAY(), 12, 30), NOW)).toBe(true)
  })

  it("accepts an instant inside the grace window so a pick seconds before the minute rolls does not flap", () => {
    const now = new Date(timeOn(NORMAL_DAY(), 12, 0).getTime() + PAST_SCHEDULE_GRACE_MS - 1_000)
    expect(isScheduleInFuture(NORMAL_DAY(), timeOn(NORMAL_DAY(), 12, 0), now)).toBe(true)
  })
})
