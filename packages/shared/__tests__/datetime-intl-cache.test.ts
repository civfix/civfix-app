import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type * as DatetimeModule from "../src/datetime.js"

type Datetime = typeof DatetimeModule

const LA = "America/Los_Angeles"
const ZONES = [
  LA,
  "America/New_York",
  "America/Phoenix",
  "Europe/London",
  "Asia/Kolkata",
  "Australia/Lord_Howe",
  "Pacific/Chatham",
  "UTC",
]
const LOCALES = ["en-US", "en-GB", "de-DE", "ko-KR", "ja-JP", "ar-EG", "hi-IN", "es", "fr-CA"]

// LA spring-forward (2026-03-08 10:00Z) and fall-back (2026-11-01 09:00Z) edges, London's
// spring-forward (2026-03-29 01:00Z), Lord Howe's half-hour fall-back (2026-04-04 15:00Z), plus an
// afternoon and a midnight-adjacent instant.
const INSTANTS = [
  "2026-03-08T09:59:00.000Z",
  "2026-03-08T10:00:00.000Z",
  "2026-11-01T08:30:00.000Z",
  "2026-11-01T09:30:00.000Z",
  "2026-03-29T00:59:00.000Z",
  "2026-03-29T01:00:00.000Z",
  "2026-04-04T14:45:00.000Z",
  "2026-04-04T15:15:00.000Z",
  "2026-09-05T20:00:00.000Z",
  "2026-09-06T06:59:00.000Z",
]
const RANGES: ReadonlyArray<readonly [string, string]> = [
  ["2026-03-08T09:00:00.000Z", "2026-03-08T11:00:00.000Z"],
  ["2026-11-01T08:00:00.000Z", "2026-11-01T10:00:00.000Z"],
  ["2026-09-05T15:00:00.000Z", "2026-09-05T17:00:00.000Z"],
  ["2026-09-05T18:30:00.000Z", "2026-09-05T21:15:00.000Z"],
  ["2026-03-29T00:30:00.000Z", "2026-03-29T02:00:00.000Z"],
]
const CLOCK = { hour: "numeric", minute: "2-digit" } as const

async function freshDatetime(): Promise<Datetime> {
  vi.resetModules()
  return import("../src/datetime.js")
}

const RealDateTimeFormat = Intl.DateTimeFormat

/** Runs `fn` with every `new Intl.DateTimeFormat(...)` recorded as its JSON-encoded arguments. */
function recordConstructs(fn: () => void): string[] {
  const seen: string[] = []
  Intl.DateTimeFormat = new Proxy(RealDateTimeFormat, {
    construct(target, args, newTarget) {
      seen.push(JSON.stringify(args))
      return Reflect.construct(target, args, newTarget) as object
    },
  })
  try {
    fn()
  } finally {
    Intl.DateTimeFormat = RealDateTimeFormat
  }
  return seen
}

function countsByArgs(seen: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const args of seen) counts.set(args, (counts.get(args) ?? 0) + 1)
  return counts
}

/** The pre-cache `timeRangeLabel`, built from fresh formatters on every call. */
function referenceTimeRange(
  startIso: string,
  endIso: string,
  locale: string,
  zone: string,
): string {
  const start = new Date(startIso)
  const end = new Date(endIso)
  const startLabel = start.toLocaleTimeString(locale, { ...CLOCK, timeZone: zone })
  const endLabel = end.toLocaleTimeString(locale, { ...CLOCK, timeZone: zone })
  const parts = (d: Date) =>
    new RealDateTimeFormat(locale, { ...CLOCK, timeZone: zone }).formatToParts(d)
  const startParts = parts(start)
  const dayPeriod = startParts.find((p) => p.type === "dayPeriod")?.value ?? null
  const endPeriod = parts(end).find((p) => p.type === "dayPeriod")?.value ?? null
  const cut = (label: string, period: string) => {
    const at = label.indexOf(period)
    return at === -1 ? "" : `${label.slice(0, at)}${label.slice(at + period.length)}`.trim()
  }
  if (dayPeriod !== null && dayPeriod === endPeriod) {
    const periodFirst =
      startParts.findIndex((p) => p.type === "dayPeriod") <
      startParts.findIndex((p) => p.type === "hour")
    if (periodFirst) {
      const trimmed = cut(endLabel, dayPeriod)
      if (trimmed !== "") return `${startLabel} – ${trimmed}`
    } else {
      const trimmed = cut(startLabel, dayPeriod)
      if (trimmed !== "") return `${trimmed} – ${endLabel}`
    }
  }
  return `${startLabel} – ${endLabel}`
}

describe("cached formatters print exactly what fresh ones do", () => {
  it("timeLabel matches toLocaleTimeString cold and warm, across locales, zones and DST edges", async () => {
    const dt = await freshDatetime()
    for (const locale of LOCALES) {
      for (const zone of ZONES) {
        for (const iso of INSTANTS) {
          const fresh = new Date(iso).toLocaleTimeString(locale, { ...CLOCK, timeZone: zone })
          expect(dt.timeLabel(iso, locale, zone)).toBe(fresh)
          expect(dt.timeLabel(iso, locale, zone)).toBe(fresh)
        }
      }
    }
  })

  it("timeRangeLabel matches the fresh-formatter algorithm, including ranges across a DST change", async () => {
    const dt = await freshDatetime()
    for (const locale of LOCALES) {
      for (const zone of ZONES) {
        for (const [start, end] of RANGES) {
          const fresh = referenceTimeRange(start, end, locale, zone)
          expect(dt.timeRangeLabel(start, end, locale, zone)).toBe(fresh)
          expect(dt.timeRangeLabel(start, end, locale, zone)).toBe(fresh)
        }
      }
    }
  })

  it("the date chip month and the event date match toLocaleDateString cold and warm", async () => {
    const dt = await freshDatetime()
    for (const locale of LOCALES) {
      for (const zone of ZONES) {
        for (const iso of INSTANTS) {
          const d = new Date(iso)
          const month = d
            .toLocaleDateString(locale, { month: "short", timeZone: zone })
            .toUpperCase()
          const date = d.toLocaleDateString(locale, {
            month: "short",
            day: "numeric",
            timeZone: zone,
          })
          for (let i = 0; i < 2; i += 1) {
            expect(dt.eventChip(iso, locale, zone).month).toBe(month)
            expect(dt.eventWhenParts({ scheduledAt: iso, timezone: zone }, { locale }).date).toBe(
              date,
            )
          }
        }
      }
    }
  })

  it("zoneShortName and the event-zone weekday match fresh formatters", async () => {
    const dt = await freshDatetime()
    for (const zone of ZONES) {
      for (const iso of INSTANTS) {
        const ms = Date.parse(iso)
        const weekday = new RealDateTimeFormat("en-US", {
          weekday: "short",
          timeZone: zone,
        }).format(ms)
        expect(dt.dowLabel(iso, undefined, zone)).toBe(weekday)
        for (const locale of LOCALES) {
          const fresh =
            new RealDateTimeFormat(locale, { timeZone: zone, timeZoneName: "short" })
              .formatToParts(ms)
              .find((p) => p.type === "timeZoneName")?.value ?? ""
          expect(dt.zoneShortName(ms, zone, locale)).toBe(fresh)
          expect(dt.zoneShortName(ms, zone, locale)).toBe(fresh)
        }
      }
    }
  })
})

describe("formatter construction", () => {
  it("builds one clock formatter per locale and zone however many rows render", async () => {
    const dt = await freshDatetime()
    const [start, end] = RANGES[2] ?? ["", ""]
    const seen = recordConstructs(() => {
      for (let row = 0; row < 25; row += 1) {
        for (const locale of ["en-US", "de-DE"]) {
          for (const zone of [LA, "Europe/London"]) {
            dt.timeRangeLabel(start, end, locale, zone)
            dt.timeLabel(start, locale, zone)
          }
        }
      }
    })
    const clockBuilds = seen.filter((args) => args.includes('"minute":"2-digit"'))
    expect(clockBuilds).toHaveLength(4)
    for (const count of countsByArgs(seen).values()) expect(count).toBe(1)
  })

  it("builds one weekday and one zone-name formatter per key", async () => {
    const dt = await freshDatetime()
    const seen = recordConstructs(() => {
      for (let row = 0; row < 25; row += 1) {
        for (const iso of INSTANTS) {
          dt.dowLabel(iso, undefined, LA)
          dt.zoneShortName(Date.parse(iso), LA, "en-US")
          dt.zoneShortName(Date.parse(iso), LA, "es")
        }
      }
    })
    expect(seen.filter((args) => args.includes('"weekday":"short"'))).toHaveLength(1)
    expect(seen.filter((args) => args.includes('"timeZoneName":"short"'))).toHaveLength(2)
    for (const count of countsByArgs(seen).values()) expect(count).toBe(1)
  })

  it("keeps building host-default formatters, which must follow the live device zone", async () => {
    const dt = await freshDatetime()
    const iso = "2026-09-05T20:00:00.000Z"
    const seen = recordConstructs(() => {
      dt.timeRangeLabel(iso, iso, "en-US")
      dt.timeRangeLabel(iso, iso, "en-US")
      dt.timeRangeLabel(iso, iso, undefined, LA)
      dt.timeRangeLabel(iso, iso, undefined, LA)
    })
    expect(seen.filter((args) => args.includes('"minute":"2-digit"'))).toHaveLength(4)
  })

  it("evicts the oldest entries instead of growing with every zone it is asked about", async () => {
    const dt = await freshDatetime()
    const zones = dt.supportedTimeZones().slice(0, 200)
    const first = zones[0] ?? LA
    const last = zones[zones.length - 1] ?? LA
    const at = Date.parse(INSTANTS[8] ?? "")
    const zoneNameBuilds = () =>
      recordConstructs(() => {
        dt.zoneShortName(at, first, "en-US")
        dt.zoneShortName(at, last, "en-US")
      }).length
    recordConstructs(() => {
      for (const zone of zones) dt.zoneShortName(at, zone, "en-US")
    })
    expect(zones.length).toBeGreaterThan(100)
    expect(zoneNameBuilds()).toBe(1)
    expect(zoneNameBuilds()).toBe(0)
  })

  it("keeps a recently used key when a sweep of other keys forces evictions", async () => {
    const dt = await freshDatetime()
    const zones = dt.supportedTimeZones().slice(0, 97)
    const hot = zones[0] ?? LA
    const at = Date.parse(INSTANTS[8] ?? "")
    const hotBuilds = (fn: () => void) =>
      recordConstructs(fn).filter((args) => args.includes(JSON.stringify(hot))).length
    expect(zones.length).toBe(97)
    expect(
      hotBuilds(() => {
        for (const zone of zones.slice(0, 64)) dt.zoneShortName(at, zone, "en-US")
        dt.zoneShortName(at, hot, "en-US")
        for (const zone of zones.slice(64)) dt.zoneShortName(at, zone, "en-US")
      }),
    ).toBe(1)
    expect(hotBuilds(() => dt.zoneShortName(at, hot, "en-US"))).toBe(0)
  })
})

describe("error behaviour is unchanged", () => {
  it("throws the constructor's RangeError for a malformed locale on every call, as before", async () => {
    const dt = await freshDatetime()
    const iso = INSTANTS[8] ?? ""
    const expected = (() => {
      try {
        new Date(iso).toLocaleTimeString("en_US!", { ...CLOCK, timeZone: LA })
      } catch (error) {
        return error
      }
      return null
    })()
    expect(expected).toBeInstanceOf(RangeError)
    for (let i = 0; i < 2; i += 1) {
      expect(() => dt.timeLabel(iso, "en_US!", LA)).toThrow(expected as RangeError)
      expect(() => dt.timeRangeLabel(iso, iso, "en_US!", LA)).toThrow(RangeError)
      expect(() => dt.timeLabel(iso, "en_US!")).toThrow(RangeError)
    }
  })

  it("still answers '' for a zone or locale the runtime rejects, on every call", async () => {
    const dt = await freshDatetime()
    const at = Date.parse(INSTANTS[8] ?? "")
    for (let i = 0; i < 2; i += 1) {
      expect(dt.zoneShortName(at, "Mars/Olympus", "en-US")).toBe("")
      expect(dt.zoneShortName(at, "", "en-US")).toBe("")
      expect(dt.zoneShortName(at, LA, "en_US!")).toBe("")
    }
    expect(dt.zoneShortName(at, LA, "en-US")).toBe("PDT")
  })

  it("safeDateFormat degrades a malformed locale to en-US and remembers that it did", async () => {
    const dt = await freshDatetime()
    const iso = INSTANTS[8] ?? ""
    const options = { month: "short", day: "numeric" } as const
    const english = dt.safeDateFormat(iso, "en-US", options, LA)
    const seen = recordConstructs(() => {
      for (let i = 0; i < 5; i += 1) {
        expect(dt.safeDateFormat(iso, "en_US!", options, LA)).toBe(english)
      }
    })
    expect(seen).toHaveLength(2)
  })
})

describe("host-default formatting follows a device zone change", () => {
  beforeEach(() => {
    vi.stubEnv("TZ", LA)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("reads the clock in whichever zone the device is on now", async () => {
    const dt = await freshDatetime()
    const iso = "2026-09-05T20:00:00.000Z"
    expect(dt.timeLabel(iso, "en-US")).toBe("1:00 PM")
    expect(dt.timeRangeLabel(iso, iso, "en-US")).toBe("1:00 – 1:00 PM")
    expect(dt.safeDateFormat(iso, "en-US", CLOCK)).toBe("1:00 PM")
    vi.stubEnv("TZ", "Asia/Tokyo")
    expect(dt.timeLabel(iso, "en-US")).toBe("5:00 AM")
    expect(dt.timeRangeLabel(iso, iso, "en-US")).toBe("5:00 – 5:00 AM")
    expect(dt.safeDateFormat(iso, "en-US", CLOCK)).toBe("5:00 AM")
  })
})
