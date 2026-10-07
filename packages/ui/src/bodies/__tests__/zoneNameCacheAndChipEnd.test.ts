import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import * as calendar from "../calendarModel"
import { DURATION_CHIP_HOURS, durationChipFor, eventDurationMs } from "../calendarModel"

const HOUR = 3_600_000
const DAY_MS = 86_400_000
const code = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")

describe("the timezone picker's display-name cache keeps one day only", () => {
  it("drops the previous day's names when the day changes instead of growing forever", () => {
    const cache = calendar.makeZoneDisplayNameCache()
    const day1 = Date.UTC(2026, 2, 1, 12)
    expect(cache.get("America/Los_Angeles", "en", day1)).toBe(calendar.zoneDisplayName("America/Los_Angeles", "en", day1))
    cache.get("Europe/Berlin", "en", day1)
    cache.get("Europe/Berlin", "en", day1 + 60_000)
    expect(cache.size()).toBe(2)

    for (let d = 1; d <= 10; d++) cache.get("Europe/Berlin", "de", day1 + d * DAY_MS)
    expect(cache.size()).toBe(1)
  })

  it("names a zone by the offset in force that day, so a DST change reads PDT rather than a cached PST", () => {
    const cache = calendar.makeZoneDisplayNameCache()
    const winter = cache.get("America/Los_Angeles", "en", Date.UTC(2026, 0, 15, 20))
    const summer = cache.get("America/Los_Angeles", "en", Date.UTC(2026, 6, 15, 20))
    expect(winter).toContain("PST")
    expect(summer).toContain("PDT")
  })

  it("warms every zone in timer slices, none inside the call, and stops when cancelled", () => {
    vi.useFakeTimers()
    try {
      const zones = Array.from({ length: 100 }, (_, i) => (i % 2 === 0 ? "Europe/Berlin" : "America/Chicago"))
      const distinct = ["Asia/Tokyo", "Europe/Paris", "America/Denver", "Australia/Sydney", "Africa/Cairo"]
      const all = [...distinct, ...zones]
      const cache = calendar.makeZoneDisplayNameCache()
      calendar.warmZoneDisplayNames(cache, all, "en")
      expect(cache.size()).toBe(0)
      vi.runAllTimers()
      expect(cache.size()).toBe(distinct.length + 2)

      const cancelled = calendar.makeZoneDisplayNameCache()
      const cancel = calendar.warmZoneDisplayNames(cancelled, distinct, "en")
      cancel()
      vi.runAllTimers()
      expect(cancelled.size()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it("is the cache TimezoneField reads", () => {
    const field = code("../TimezoneField.tsx")
    expect(field).toContain("const displayNames = makeZoneDisplayNameCache()")
    expect(field).not.toContain("new Map<string, string>()")
    expect(field).toContain("return warmZoneDisplayNames(displayNames, allTimeZones(), locale)")
  })
})

describe("a duration chip sets an end that many REAL hours after the start, in the event's zone", () => {
  const endAfter = (
    calendar as unknown as {
      endTimeAfterInZone: (date: Date, start: Date, offsetMs: number, timeZone: string) => Date
    }
  ).endTimeAfterInZone

  it("makes '2 h' two real hours on the Berlin spring-forward night, and lights that chip", () => {
    const day = new Date(2026, 2, 29)
    const start = new Date(2026, 2, 29, 1, 30)
    for (const hours of DURATION_CHIP_HOURS) {
      const end = endAfter(day, start, hours * HOUR, "Europe/Berlin")
      expect(eventDurationMs(day, start, end, "Europe/Berlin")).toBe(hours * HOUR)
      expect(durationChipFor(day, start, end, "Europe/Berlin")).toBe(hours)
    }
    expect(endAfter(day, start, 2 * HOUR, "Europe/Berlin").getHours()).toBe(4)
  })

  it("matches the wall-clock sum on an ordinary day and across midnight", () => {
    const day = new Date(2026, 5, 10)
    const late = new Date(2026, 5, 10, 22, 0)
    const end = endAfter(day, late, 4 * HOUR, "America/Los_Angeles")
    expect([end.getHours(), end.getMinutes()]).toEqual([2, 0])
    expect(durationChipFor(day, late, end, "America/Los_Angeles")).toBe(4)
  })

  it("falls back to the wall-clock sum when the start does not exist in the zone", () => {
    const day = new Date(2026, 2, 8)
    const inGap = new Date(2026, 2, 8, 2, 30)
    const end = endAfter(day, inGap, 1 * HOUR, "America/Los_Angeles")
    expect([end.getHours(), end.getMinutes()]).toEqual([3, 30])
  })

  it("is what the picker's chips call", () => {
    expect(code("../InlineDateTimePicker.shared.tsx")).toContain(
      "onEndTimeChange(endTimeAfterInZone(date, time, hours * 3_600_000, timeZone))",
    )
  })
})
