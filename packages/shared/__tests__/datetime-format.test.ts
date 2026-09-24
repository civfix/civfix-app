import { afterEach, describe, expect, it, vi } from "vitest"
import {
  datetimeLocalFromIso,
  eventZoneSuffix,
  formatEventInstant,
  isoFromDatetimeLocal,
  safeDateFormat,
} from "../src/datetime.js"

const LA = "America/Los_Angeles"
const NEW_YORK = "America/New_York"
const SAT_NOON_UTC_MINUS_7 = "2026-09-12T17:00:00.000Z"

describe("safeDateFormat", () => {
  const AT = "2026-09-16T12:00:00.000Z"

  it("says nothing for a missing or unparseable instant", () => {
    expect(safeDateFormat(null, "en-US", { month: "short" })).toBe("")
    expect(safeDateFormat(undefined, "en-US", { month: "short" })).toBe("")
    expect(safeDateFormat("", "en-US", { month: "short" })).toBe("")
    expect(safeDateFormat("not-a-date", "en-US", { month: "short" })).toBe("")
  })

  it("reads the instant on the zone it is given", () => {
    const options = { hour: "numeric", minute: "2-digit", timeZoneName: "short" } as const
    expect(safeDateFormat(SAT_NOON_UTC_MINUS_7, "en-US", options, LA)).toBe("10:00 AM PDT")
    expect(safeDateFormat(SAT_NOON_UTC_MINUS_7, "en-US", options, NEW_YORK)).toBe("1:00 PM EDT")
    expect(safeDateFormat("2026-03-04T10:00:00.000Z", "en-US", { dateStyle: "medium" }, "UTC")).toBe(
      "Mar 4, 2026",
    )
  })

  it("keeps the viewer's language and only drops a malformed zone", () => {
    const month = safeDateFormat(AT, "ko-KR", { month: "short" }, "Not/A_Zone")
    expect(month).toBe(new Intl.DateTimeFormat("ko-KR", { month: "short" }).format(new Date(AT)))
    expect(month.toUpperCase()).not.toBe("SEP")
  })

  it("falls back to en-US rather than throwing on a locale the runtime rejects", () => {
    expect(
      safeDateFormat("2026-03-04T10:00:00.000Z", "!!not-a-locale", { dateStyle: "medium" }, "UTC"),
    ).toBe("Mar 4, 2026")
  })

  it("formats with the locale's own digits and words", () => {
    expect(safeDateFormat(AT, "ko-KR", { day: "numeric" }, "UTC")).toBe("16일")
    expect(safeDateFormat(AT, "de", { weekday: "long" }, "UTC")).toBe("Mittwoch")
  })

  describe("formatter reuse", () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it("builds no new Intl formatter when a row renders again with the same locale, zone and options", () => {
      const options = { weekday: "short", month: "long", day: "2-digit" } as const
      const first = safeDateFormat(AT, "es", options, "Europe/Madrid")
      const spy = vi.spyOn(Intl, "DateTimeFormat")
      for (let i = 0; i < 5; i += 1) {
        expect(safeDateFormat(AT, "es", { ...options }, "Europe/Madrid")).toBe(first)
      }
      expect(spy).not.toHaveBeenCalled()
    })
  })
})

describe("formatEventInstant", () => {
  it("prints a short, zone-labelled instant in the event's own zone", () => {
    expect(formatEventInstant(SAT_NOON_UTC_MINUS_7, NEW_YORK, "short")).toBe(
      "Sat, Sep 12, 1:00 PM EDT",
    )
  })

  it("uses the platform zone for a legacy row or an unusable zone", () => {
    expect(formatEventInstant(SAT_NOON_UTC_MINUS_7, undefined, "short")).toBe(
      "Sat, Sep 12, 10:00 AM PDT",
    )
    expect(formatEventInstant(SAT_NOON_UTC_MINUS_7, null, "short")).toBe("Sat, Sep 12, 10:00 AM PDT")
    expect(formatEventInstant(SAT_NOON_UTC_MINUS_7, "Mars/Olympus", "short")).toBe(
      "Sat, Sep 12, 10:00 AM PDT",
    )
    expect(formatEventInstant(SAT_NOON_UTC_MINUS_7, "", "short")).toBe("Sat, Sep 12, 10:00 AM PDT")
  })

  it("says nothing for a missing or unparseable instant", () => {
    expect(formatEventInstant(null, LA, "short")).toBe("")
    expect(formatEventInstant(undefined, LA, "short")).toBe("")
    expect(formatEventInstant("nonsense", null, "long", "en")).toBe("")
  })

  it("formats the long style in the visitor's active locale, not always en-US", () => {
    const when = formatEventInstant(SAT_NOON_UTC_MINUS_7, NEW_YORK, "long", "de")
    expect(when).toContain("Samstag")
    expect(when).not.toContain("Saturday")
  })

  it("keeps the event's own time zone in the long style", () => {
    expect(formatEventInstant(SAT_NOON_UTC_MINUS_7, NEW_YORK, "long", "en")).toContain("1:00")
    expect(formatEventInstant(SAT_NOON_UTC_MINUS_7, NEW_YORK, "long", "en")).toBe(
      "Saturday, September 12 at 1:00 PM EDT",
    )
  })

  it("survives an unknown zone in the long style", () => {
    expect(formatEventInstant(SAT_NOON_UTC_MINUS_7, "Mars/Olympus", "long", "en")).toContain(
      "September",
    )
    expect(formatEventInstant(SAT_NOON_UTC_MINUS_7, "Mars/Olympus", "long", "en")).toBe(
      "Saturday, September 12 at 10:00 AM PDT",
    )
  })
})

describe("eventZoneSuffix", () => {
  const at = Date.parse(SAT_NOON_UTC_MINUS_7)

  it("names the event's zone when the viewer reads another offset", () => {
    expect(eventZoneSuffix(at, NEW_YORK, LA, "en-US")).toBe("EDT")
  })

  it("stays silent on a shared offset, a missing zone or an unusable zone", () => {
    expect(eventZoneSuffix(at, NEW_YORK, "America/Toronto", "en-US")).toBeNull()
    expect(eventZoneSuffix(at, undefined, LA, "en-US")).toBeNull()
    expect(eventZoneSuffix(at, NEW_YORK, undefined, "en-US")).toBeNull()
    expect(eventZoneSuffix(at, null, LA, "en-US")).toBeNull()
    expect(eventZoneSuffix(at, "Not/A_Zone", LA, "en-US")).toBeNull()
    expect(eventZoneSuffix(at, "Not/A_Zone", "UTC", "en-US")).toBeNull()
  })
})

describe("console datetime-local inputs in the event's zone", () => {
  const OPENS = SAT_NOON_UTC_MINUS_7

  it("shows a stored instant as the event's wall clock, not the UTC one", () => {
    expect(datetimeLocalFromIso(OPENS, LA)).toBe("2026-09-12T10:00")
    expect(datetimeLocalFromIso(OPENS, "Asia/Seoul")).toBe("2026-09-13T02:00")
    expect(datetimeLocalFromIso(null, LA)).toBe("")
    expect(datetimeLocalFromIso(undefined, LA)).toBe("")
    expect(datetimeLocalFromIso("not a date", LA)).toBe("")
  })

  it("reads an input back as that zone's instant, so a round trip is exact", () => {
    expect(isoFromDatetimeLocal(datetimeLocalFromIso(OPENS, LA), LA)).toEqual({
      kind: "instant",
      iso: OPENS,
    })
    expect(isoFromDatetimeLocal("2026-12-01T09:30", LA)).toEqual({
      kind: "instant",
      iso: "2026-12-01T17:30:00.000Z",
    })
    expect(isoFromDatetimeLocal("2026-12-01T09:30:45", LA)).toEqual({
      kind: "instant",
      iso: "2026-12-01T17:30:00.000Z",
    })
    expect(isoFromDatetimeLocal("", LA)).toEqual({ kind: "empty" })
  })

  it("refuses a wall clock skipped by a spring-forward change instead of shifting it", () => {
    expect(isoFromDatetimeLocal("2026-03-08T02:30", LA)).toEqual({ kind: "invalid" })
    expect(isoFromDatetimeLocal("2026-03-08T02:00", LA)).toEqual({ kind: "invalid" })
    expect(isoFromDatetimeLocal("2026-03-29T02:30", "Europe/Berlin")).toEqual({ kind: "invalid" })
    expect(isoFromDatetimeLocal("2026-10-04T02:30", "Australia/Sydney")).toEqual({ kind: "invalid" })
    expect(isoFromDatetimeLocal("not a date", LA)).toEqual({ kind: "invalid" })
    expect(isoFromDatetimeLocal("2026-12-01 09:30", LA)).toEqual({ kind: "invalid" })
  })

  it("accepts the minutes on either side of the spring-forward gap at their own offsets", () => {
    expect(isoFromDatetimeLocal("2026-03-08T01:59", LA)).toEqual({
      kind: "instant",
      iso: "2026-03-08T09:59:00.000Z",
    })
    expect(isoFromDatetimeLocal("2026-03-08T03:00", LA)).toEqual({
      kind: "instant",
      iso: "2026-03-08T10:00:00.000Z",
    })
  })

  it("shows both passes of the repeated fall-back hour as the same wall clock", () => {
    expect(datetimeLocalFromIso("2026-11-01T08:30:00.000Z", LA)).toBe("2026-11-01T01:30")
    expect(datetimeLocalFromIso("2026-11-01T09:30:00.000Z", LA)).toBe("2026-11-01T01:30")
  })

  it("reads a repeated fall-back wall clock as one of its two real instants", () => {
    for (const [value, zone, candidates] of [
      ["2026-11-01T01:30", LA, ["2026-11-01T08:30:00.000Z", "2026-11-01T09:30:00.000Z"]],
      ["2026-10-25T02:30", "Europe/Berlin", ["2026-10-25T00:30:00.000Z", "2026-10-25T01:30:00.000Z"]],
    ] as const) {
      const parsed = isoFromDatetimeLocal(value, zone)
      expect(parsed.kind).toBe("instant")
      const iso = parsed.kind === "instant" ? parsed.iso : ""
      expect(candidates).toContain(iso)
      expect(datetimeLocalFromIso(iso, zone)).toBe(value)
    }
  })
})
