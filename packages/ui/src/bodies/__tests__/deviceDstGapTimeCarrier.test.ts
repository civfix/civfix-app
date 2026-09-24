process.env.TZ = "America/Los_Angeles"

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  formInstantMs,
  formWallClock,
  timeCarrier,
  wallClockToFormDate,
  wallClockToFormTime,
} from "../calendarModel"
import { buildEventPreviewCard } from "../feedShare"

const code = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")

// 2026-03-08 is the US spring-forward day: on this (Los Angeles) device 02:00-02:59 does not exist, while an
// event in Phoenix (no DST) runs at 02:30 that night like any other.
const gapDay = () => new Date(2026, 2, 8, 12)
const PHOENIX = "America/Phoenix"
const PHOENIX_0230_UTC = Date.UTC(2026, 2, 8, 9, 30)
const organizer = { id: "u-1", displayName: "Host", handle: null, avatarUrl: null } as never

describe("a clock inside the DEVICE's DST gap survives the event form", () => {
  it("the device really has the gap: a Date on that day cannot hold 02:30", () => {
    const naive = new Date(2026, 2, 8, 2, 30)
    expect([naive.getHours(), naive.getMinutes()]).toEqual([3, 30])
  })

  it("keeps 02:30 as the picked time and saves 02:30 in the event's zone", () => {
    const time = timeCarrier(gapDay(), 2, 30)
    expect([time.getHours(), time.getMinutes()]).toEqual([2, 30])
    expect(formWallClock(gapDay(), time)).toEqual({ year: 2026, month: 3, day: 8, hours: 2, minutes: 30 })
    expect(formInstantMs(gapDay(), time, PHOENIX)).toBe(PHOENIX_0230_UTC)
  })

  it("keeps the carrier on the picked day when that day has no offset change", () => {
    const time = timeCarrier(new Date(2026, 5, 10, 12), 2, 30)
    expect(time.getTime()).toBe(new Date(2026, 5, 10, 2, 30).getTime())
  })

  it("loads a saved 02:30 event back as 02:30, on its own day", () => {
    const wallClock = { year: 2026, month: 3, day: 8, hours: 2, minutes: 30 }
    expect(formWallClock(wallClockToFormDate(wallClock), wallClockToFormTime(wallClock))).toEqual(wallClock)
  })

  it("previews the share card at the event-zone instant, not the device-shifted one", () => {
    const card = buildEventPreviewCard(
      {
        title: "Night market",
        eventKind: "cleanup",
        coords: null,
        date: gapDay(),
        time: timeCarrier(gapDay(), 2, 30),
        timezone: PHOENIX,
      },
      organizer,
    )
    expect(card?.scheduledAt).toBe(new Date(PHOENIX_0230_UTC).toISOString())
  })

  it("also holds where the device's gap starts at midnight (Santiago, 2026-09-06 00:00 -> 01:00)", () => {
    process.env.TZ = "America/Santiago"
    try {
      const day = new Date(2026, 8, 6, 12)
      expect(new Date(2026, 8, 6, 0, 30).getHours()).toBe(1)
      const time = timeCarrier(day, 0, 30)
      expect([time.getHours(), time.getMinutes()]).toEqual([0, 30])
      expect(formInstantMs(day, time, "America/Lima")).toBe(Date.UTC(2026, 8, 6, 5, 30))
    } finally {
      process.env.TZ = "America/Los_Angeles"
    }
  })

  it("is how both pickers, the date change and the edit, duplicate, wizard and slot seeds build a time", () => {
    const native = code("../InlineDateTimePicker.native.tsx")
    expect(code("../InlineDateTimePicker.web.tsx")).toContain(
      "onChange(timeCarrier(day ?? value ?? new Date(), parsed.hours, parsed.minutes))",
    )
    expect(native).toContain(
      "onChange(timeCarrier(day ?? value ?? picked, picked.getHours(), picked.getMinutes()))",
    )
    expect(native).toContain("const current = value ?? timeCarrier(base, base.getHours(), base.getMinutes())")
    expect(code("../CleanupForm.tsx")).toContain("timeCarrier(date, value.time.getHours(), value.time.getMinutes())")
    expect(code("../host/dashboard/DuplicateEventSheet.tsx")).toContain("setTime(wallClockToFormTime(wallClock))")
    expect(code("../EditCleanupBody.tsx")).toContain("time: wallClockToFormTime(start)")
    expect(code("../eventWizard.ts")).toContain("wallClockToFormTime(wallClockInZone(endMs, timeZone))")
    expect(code("../SlotWindowPicker.tsx")).toContain("wallClockToFormTime(wallClockInZone(instant.getTime(), timeZone))")
  })
})
