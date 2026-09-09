import { describe, it, expect } from "vitest"
import { relativeAgo, eventChip, dowLabel, timeLabel } from "../src/datetime.js"

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
