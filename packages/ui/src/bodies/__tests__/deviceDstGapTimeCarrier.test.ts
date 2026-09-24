import { readFileSync } from "node:fs"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  formInstantMs,
  formWallClock,
  timeCarrier,
  wallClockToFormDate,
  wallClockToFormTime,
} from "../calendarModel"

const code = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")

// 2026-03-08 is the US spring-forward day: on a US device 02:00-02:59 does not exist, while an event in
// Phoenix (no DST) or Berlin (its change is on 03-29) runs at 02:30 that night like any other.
const GAP_DAY = new Date(2026, 2, 8, 12)
const PHOENIX = "America/Phoenix"
const PHOENIX_0230_UTC = Date.UTC(2026, 2, 8, 9, 30)

describe("a clock inside the DEVICE's DST gap survives the event form", () => {
  const deviceZone = process.env.TZ

  beforeAll(() => {
    process.env.TZ = "America/Los_Angeles"
  })

  afterAll(() => {
    process.env.TZ = deviceZone
  })

  it("the device really has the gap: a Date on that day cannot hold 02:30", () => {
    const naive = new Date(2026, 2, 8, 2, 30)
    expect([naive.getHours(), naive.getMinutes()]).toEqual([3, 30])
  })

  it("keeps 02:30 as the picked time and saves 02:30 in the event's zone", () => {
    const time = timeCarrier(GAP_DAY, 2, 30)
    expect([time.getHours(), time.getMinutes()]).toEqual([2, 30])
    expect(formWallClock(GAP_DAY, time)).toEqual({ year: 2026, month: 3, day: 8, hours: 2, minutes: 30 })
    expect(formInstantMs(GAP_DAY, time, PHOENIX)).toBe(PHOENIX_0230_UTC)
  })

  it("keeps the carrier on the picked day when that day has no offset change", () => {
    const ordinary = new Date(2026, 5, 10, 12)
    const time = timeCarrier(ordinary, 2, 30)
    expect(time.getTime()).toBe(new Date(2026, 5, 10, 2, 30).getTime())
  })

  it("loads a saved 02:30 event back as 02:30, on its own day", () => {
    const wallClock = { year: 2026, month: 3, day: 8, hours: 2, minutes: 30 }
    const date = wallClockToFormDate(wallClock)
    const time = wallClockToFormTime(wallClock)
    expect(formWallClock(date, time)).toEqual(wallClock)
  })

  it("is how both pickers, the date change and the edit, duplicate, wizard and slot seeds build a time", () => {
    expect(code("../InlineDateTimePicker.web.tsx")).toContain(
      "onChange(timeCarrier(day ?? value ?? new Date(), parsed.hours, parsed.minutes))",
    )
    expect(code("../InlineDateTimePicker.native.tsx")).toContain(
      "onChange(timeCarrier(day ?? value ?? picked, picked.getHours(), picked.getMinutes()))",
    )
    expect(code("../CleanupForm.tsx")).toContain("timeCarrier(date, value.time.getHours(), value.time.getMinutes())")
    expect(code("../host/dashboard/DuplicateEventSheet.tsx")).toContain("setTime(wallClockToFormTime(wallClock))")
    expect(code("../EditCleanupBody.tsx")).toContain("time: wallClockToFormTime(start)")
    expect(code("../eventWizard.ts")).toContain("wallClockToFormTime(wallClockInZone(endMs, timeZone))")
    expect(code("../SlotWindowPicker.tsx")).toContain("wallClockToFormTime(wallClockInZone(instant.getTime(), timeZone))")
  })
})
