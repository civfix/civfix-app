/**
 * Framework-neutral relative-time formatting.
 *
 * This is the SINGLE SOURCE for the compact "ago" label that previously had three near-identical
 * implementations (backend threads service, web `relativeTime`, mobile `relativeTime`). Reconciling
 * them into one function means the server and both clients produce identical text.
 *
 * STYLE + THRESHOLDS (the reconciled, documented behavior):
 *   - future or < 60 seconds ago  -> "now"
 *   - < 60 minutes                -> "<N>m"   (whole minutes, floored)
 *   - < 24 hours                  -> "<N>h"   (whole hours, floored)
 *   - < 7 days                    -> "<N>d"   (whole days, floored)
 *   - >= 7 days                   -> "<N>w"   (whole weeks, floored) by default, OR an absolute date
 *                                    string when an `absoluteFallback` formatter is supplied.
 *
 * Reconciliation notes:
 *   - The web/mobile copies rendered "now" while the backend rendered "just now"; "now" wins (two of
 *     three, and it is the shorter list-row label). Callers that want "just now" can pass `justNow`.
 *   - The web/mobile copies fell back to a short Intl date past one week. To stay strictly portable
 *     (no Intl dependency in the shared core, which must run on any RN engine) the default past-week
 *     bucket is "<N>w"; a caller that wants an absolute date passes `absoluteFallback` (web/mobile can
 *     pass an Intl formatter, the backend passes none).
 *
 * The function is pure: pass `now` to make it deterministic in tests. An unparseable / invalid input
 * yields "" so a bad timestamp never throws in a render path.
 */

/**
 * The four compact relative-time unit suffixes, in the default English form. The `@civfix/ui` layer
 * passes localized replacements (sourced from the `common-datetime` catalog) into `relativeAgo` via
 * `RelativeAgoOptions.units`; the backend / any caller that omits them keeps this English default, so
 * existing behavior is unchanged. Each is appended to the floored count, e.g. `${n}${units.minute}`.
 */
export interface RelativeUnitLabels {
  /** minutes bucket suffix (default "m"). */
  minute: string
  /** hours bucket suffix (default "h"). */
  hour: string
  /** days bucket suffix (default "d"). */
  day: string
  /** weeks bucket suffix (default "w"). */
  week: string
}

/** The default (English) compact unit suffixes. Exported so the UI layer can show/diff them. */
export const DEFAULT_RELATIVE_UNITS: RelativeUnitLabels = {
  minute: "m",
  hour: "h",
  day: "d",
  week: "w",
}

export interface RelativeAgoOptions {
  /** Label for the just-now bucket (< 60s, or a future time). Defaults to "now". */
  justNow?: string
  /**
   * Localized compact unit suffixes (minute/hour/day/week). When omitted the English defaults
   * (`DEFAULT_RELATIVE_UNITS`: "m"/"h"/"d"/"w") are used, so existing callers are unaffected. The
   * `@civfix/ui` `useRelativeTime` hook feeds these from the active locale's `common-datetime` catalog.
   */
  units?: Partial<RelativeUnitLabels>
  /**
   * Absolute formatter used past the one-week threshold instead of "<N>w". Receives the parsed Date.
   * Web/mobile pass an Intl-based short date; the backend omits it (and gets the "<N>w" bucket).
   */
  absoluteFallback?: (d: Date) => string
}

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

/** Coerce a Date | string | number into epoch ms, or null when it does not parse to a real time. */
function toEpochMs(value: Date | string | number): number | null {
  if (value instanceof Date) {
    const t = value.getTime()
    return Number.isNaN(t) ? null : t
  }
  if (typeof value === "number") {
    return Number.isNaN(value) ? null : value
  }
  const t = Date.parse(value)
  return Number.isNaN(t) ? null : t
}

/**
 * Compact relative-time label. See the module header for the exact thresholds.
 *
 * @param date  the timestamp to describe (Date, ISO string, or epoch ms)
 * @param now   the reference "current" time (Date or epoch ms); defaults to Date.now()
 * @param opts  optional `justNow` override and an `absoluteFallback` for the past-week bucket
 */
export function relativeAgo(
  date: Date | string | number,
  now?: Date | number,
  opts?: RelativeAgoOptions,
): string {
  const fromMs = toEpochMs(date)
  if (fromMs === null) return ""
  const nowMs = now === undefined ? Date.now() : now instanceof Date ? now.getTime() : now
  if (Number.isNaN(nowMs)) return ""

  const justNow = opts?.justNow ?? "now"
  const units = opts?.units
  const minute = units?.minute ?? DEFAULT_RELATIVE_UNITS.minute
  const hour = units?.hour ?? DEFAULT_RELATIVE_UNITS.hour
  const day = units?.day ?? DEFAULT_RELATIVE_UNITS.day
  const week = units?.week ?? DEFAULT_RELATIVE_UNITS.week
  const diff = nowMs - fromMs

  // Future timestamps and anything under a minute collapse to the just-now label.
  if (diff < MINUTE) return justNow
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}${minute}`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}${hour}`
  if (diff < WEEK) return `${Math.floor(diff / DAY)}${day}`

  if (opts?.absoluteFallback) return opts.absoluteFallback(new Date(fromMs))
  return `${Math.floor(diff / WEEK)}${week}`
}

export interface WallClock {
  year: number
  month: number
  day: number
  hours: number
  minutes: number
}

export const COMMON_TIMEZONES: readonly string[] = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Phoenix",
  "America/Chicago",
  "America/New_York",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Puerto_Rico",
]

const zoneFormatters = new Map<string, Intl.DateTimeFormat | null>()

function zoneFormatter(timeZone: string): Intl.DateTimeFormat | null {
  const cached = zoneFormatters.get(timeZone)
  if (cached !== undefined) return cached
  let formatter: Intl.DateTimeFormat | null
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    })
  } catch {
    formatter = null
  }
  zoneFormatters.set(timeZone, formatter)
  return formatter
}

function numericPart(parts: readonly Intl.DateTimeFormatPart[], type: string): number {
  const part = parts.find((p) => p.type === type)
  return part === undefined ? Number.NaN : Number(part.value)
}

function hostWallClock(date: Date): WallClock {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hours: date.getHours(),
    minutes: date.getMinutes(),
  }
}

export function isValidTimeZone(timeZone: string): boolean {
  return zoneFormatter(timeZone) !== null
}

export function supportedTimeZones(): readonly string[] {
  const supported = (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf
  if (typeof supported !== "function") return COMMON_TIMEZONES
  try {
    const values = supported.call(Intl, "timeZone")
    return values.length > 0 ? values : COMMON_TIMEZONES
  } catch {
    return COMMON_TIMEZONES
  }
}

export function zoneOffsetMs(instantMs: number, timeZone: string): number {
  const formatter = zoneFormatter(timeZone)
  if (formatter === null || !Number.isFinite(instantMs)) return 0
  const parts = formatter.formatToParts(new Date(instantMs))
  const asUtc = Date.UTC(
    numericPart(parts, "year"),
    numericPart(parts, "month") - 1,
    numericPart(parts, "day"),
    numericPart(parts, "hour"),
    numericPart(parts, "minute"),
    numericPart(parts, "second"),
  )
  if (Number.isNaN(asUtc)) return 0
  return asUtc - Math.floor(instantMs / 1000) * 1000
}

export function wallClockInZone(instantMs: number, timeZone: string): WallClock {
  const date = new Date(instantMs)
  const formatter = zoneFormatter(timeZone)
  if (formatter === null || Number.isNaN(date.getTime())) return hostWallClock(date)
  const parts = formatter.formatToParts(date)
  return {
    year: numericPart(parts, "year"),
    month: numericPart(parts, "month"),
    day: numericPart(parts, "day"),
    hours: numericPart(parts, "hour"),
    minutes: numericPart(parts, "minute"),
  }
}

function sameWallClock(a: WallClock, b: WallClock): boolean {
  return (
    a.year === b.year &&
    a.month === b.month &&
    a.day === b.day &&
    a.hours === b.hours &&
    a.minutes === b.minutes
  )
}

export function wallClockToInstantMs(wallClock: WallClock, timeZone: string): number | null {
  const guess = Date.UTC(
    wallClock.year,
    wallClock.month - 1,
    wallClock.day,
    wallClock.hours,
    wallClock.minutes,
  )
  if (Number.isNaN(guess)) return null
  const offset = zoneOffsetMs(guess - zoneOffsetMs(guess, timeZone), timeZone)
  const candidate = guess - offset
  return sameWallClock(wallClockInZone(candidate, timeZone), wallClock) ? candidate : null
}

export function wallClockExistsInZone(wallClock: WallClock, timeZone: string): boolean {
  return wallClockToInstantMs(wallClock, timeZone) !== null
}

export function zoneShortName(instantMs: number, timeZone: string, locale?: string): string {
  const date = new Date(instantMs)
  if (Number.isNaN(date.getTime())) return ""
  try {
    const parts = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "short" }).formatToParts(
      date,
    )
    return parts.find((p) => p.type === "timeZoneName")?.value ?? ""
  } catch {
    return ""
  }
}

export function sameOffsetAt(instantMs: number, zoneA: string, zoneB: string): boolean {
  return zoneOffsetMs(instantMs, zoneA) === zoneOffsetMs(instantMs, zoneB)
}

function usableZone(timeZone: string | null | undefined): string | undefined {
  if (timeZone === null || timeZone === undefined || timeZone === "") return undefined
  return isValidTimeZone(timeZone) ? timeZone : undefined
}

function zonedWallClock(instantMs: number, timeZone: string | undefined): WallClock {
  return timeZone === undefined
    ? hostWallClock(new Date(instantMs))
    : wallClockInZone(instantMs, timeZone)
}

/**
 * Pure, framework-free calendar/clock formatting helpers shared by the event + profile surfaces on
 * every client. These were duplicated in the mobile app's `lib/datetime` and the web app's format
 * helpers; lifting them here makes the two clients (and any future one) read identically.
 *
 * They use the platform `Intl` (via `Date#toLocale*`), which is available on every target the shared
 * package runs on (Node 20+, Hermes/JSC on RN, every browser). Unlike `relativeAgo` - whose core stays
 * Intl-free so it can run on the most minimal RN engine - these are intrinsically locale/calendar
 * formatters, so depending on Intl is unavoidable and acceptable. Every helper guards an unparseable
 * input by returning a benign placeholder instead of throwing in a render path.
 */

/**
 * Default short weekday labels, indexed by `Date#getDay()` (0 = Sunday). Exported so the `@civfix/ui`
 * layer can show/diff the English defaults; callers localize by passing a 7-length array to `dowLabel`.
 */
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

/**
 * { day, month } for the design's `.pi-ev-card .date` / `.erow .date` chip: a big day number over a
 * tiny uppercase month (e.g. { day: "30", month: "MAY" }). Returns "--"/"--" for an invalid input.
 *
 * `locale` (an optional BCP-47 tag) selects the month's language via the platform `Intl`; omitted (the
 * default) uses the host's default locale, so existing callers are unchanged. The `@civfix/ui` layer
 * passes the active locale so the chip month localizes with the rest of the UI.
 */
export function eventChip(
  iso: string,
  locale?: string,
  timeZone?: string,
): { day: string; month: string } {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { day: "--", month: "--" }
  const zone = usableZone(timeZone)
  return {
    day: String(zonedWallClock(d.getTime(), zone).day),
    month: d.toLocaleDateString(locale, { month: "short", timeZone: zone }).toUpperCase(),
  }
}

/**
 * Short weekday like "Sat" for an event sub line (design `.pi-ev-card .meta .s`). "" if invalid.
 *
 * `weekdays` (optional) is a 7-length array of localized short weekday labels indexed by
 * `Date#getDay()` (0 = Sunday); omitted, the English `WEEKDAYS` default is used so existing callers are
 * unchanged. The `@civfix/ui` layer passes the active locale's labels from the `common-datetime` catalog.
 */
export function dowLabel(
  iso: string,
  weekdays?: readonly string[],
  timeZone?: string,
): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const labels = weekdays ?? WEEKDAYS
  return labels[weekdayIndex(d, usableZone(timeZone))] ?? ""
}

function weekdayIndex(date: Date, timeZone: string | undefined): number {
  if (timeZone === undefined) return date.getDay()
  const short = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone }).format(date)
  const index = WEEKDAYS.indexOf(short as (typeof WEEKDAYS)[number])
  return index === -1 ? date.getDay() : index
}

/**
 * Time of day like "9:00 AM". "" for an invalid input. `locale` (optional BCP-47 tag) localizes the
 * clock format via the platform `Intl`; omitted uses the host default, so existing callers are unchanged.
 */
export function timeLabel(iso: string, locale?: string, timeZone?: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: usableZone(timeZone),
  })
}

const TIME_RANGE_SEPARATOR = " – "

function clockParts(d: Date, locale?: string, timeZone?: string): Intl.DateTimeFormatPart[] {
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: usableZone(timeZone),
  }).formatToParts(d)
}

function dayPeriodOf(parts: readonly Intl.DateTimeFormatPart[]): string | null {
  const part = parts.find((p) => p.type === "dayPeriod")
  return part === undefined ? null : part.value
}

function dayPeriodLeadsClock(parts: readonly Intl.DateTimeFormatPart[]): boolean {
  const dayPeriod = parts.findIndex((p) => p.type === "dayPeriod")
  const hour = parts.findIndex((p) => p.type === "hour")
  return dayPeriod !== -1 && hour !== -1 && dayPeriod < hour
}

function withoutDayPeriod(label: string, dayPeriod: string): string {
  const at = label.indexOf(dayPeriod)
  if (at === -1) return ""
  return `${label.slice(0, at)}${label.slice(at + dayPeriod.length)}`.trim()
}

export function timeRangeLabel(
  startIso: string,
  endIso: string,
  locale?: string,
  timeZone?: string,
): string {
  const start = new Date(startIso)
  const end = new Date(endIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return ""
  const startLabel = timeLabel(startIso, locale, timeZone)
  const endLabel = timeLabel(endIso, locale, timeZone)
  const startParts = clockParts(start, locale, timeZone)
  const dayPeriod = dayPeriodOf(startParts)
  if (dayPeriod !== null && dayPeriod === dayPeriodOf(clockParts(end, locale, timeZone))) {
    if (dayPeriodLeadsClock(startParts)) {
      const trimmedEnd = withoutDayPeriod(endLabel, dayPeriod)
      if (trimmedEnd !== "") return `${startLabel}${TIME_RANGE_SEPARATOR}${trimmedEnd}`
    } else {
      const trimmedStart = withoutDayPeriod(startLabel, dayPeriod)
      if (trimmedStart !== "") return `${trimmedStart}${TIME_RANGE_SEPARATOR}${endLabel}`
    }
  }
  return `${startLabel}${TIME_RANGE_SEPARATOR}${endLabel}`
}

export interface EventWhenInput {
  scheduledAt: string
  endsAt?: string | null
  timezone?: string | null
}

export interface EventWhenOptions {
  locale?: string
  weekdays?: readonly string[]
  viewerTimeZone?: string
  now?: number
}

export interface EventWhenParts {
  dow: string
  date: string
  time: string
  range: string | null
  zone: string | null
}

function zoneSuffix(
  instantMs: number,
  eventZone: string | undefined,
  viewerZone: string | undefined,
  locale: string | undefined,
): string | null {
  if (eventZone === undefined || viewerZone === undefined) return null
  if (sameOffsetAt(instantMs, eventZone, viewerZone)) return null
  const short = zoneShortName(instantMs, eventZone, locale)
  return short === "" ? null : short
}

function sameCalendarDay(a: WallClock, b: WallClock): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day
}

function spanLabel(
  startIso: string,
  endIso: string,
  locale: string | undefined,
  weekdays: readonly string[] | undefined,
  zone: string | undefined,
): string {
  const startWall = zonedWallClock(Date.parse(startIso), zone)
  const endWall = zonedWallClock(Date.parse(endIso), zone)
  if (sameCalendarDay(startWall, endWall)) return timeRangeLabel(startIso, endIso, locale, zone)
  const endDow = dowLabel(endIso, weekdays, zone)
  const endTime = timeLabel(endIso, locale, zone)
  const end = endDow === "" ? endTime : `${endDow} ${endTime}`
  return `${timeLabel(startIso, locale, zone)}${TIME_RANGE_SEPARATOR}${end}`
}

export function eventWhenParts(event: EventWhenInput, opts: EventWhenOptions = {}): EventWhenParts {
  const start = new Date(event.scheduledAt)
  if (Number.isNaN(start.getTime())) return { dow: "", date: "", time: "", range: null, zone: null }

  const zone = usableZone(event.timezone)
  const { locale, weekdays } = opts
  const endIso = event.endsAt ?? null
  const hasEnd = endIso !== null && !Number.isNaN(Date.parse(endIso))

  return {
    dow: dowLabel(event.scheduledAt, weekdays, zone),
    date: start.toLocaleDateString(locale, { month: "short", day: "numeric", timeZone: zone }),
    time: timeLabel(event.scheduledAt, locale, zone),
    range: hasEnd ? spanLabel(event.scheduledAt, endIso, locale, weekdays, zone) : null,
    zone: zoneSuffix(start.getTime(), zone, usableZone(opts.viewerTimeZone), locale),
  }
}

export function eventWhenLabel(event: EventWhenInput, opts: EventWhenOptions = {}): string {
  const parts = eventWhenParts(event, opts)
  if (parts.time === "") return ""
  const when = `${parts.dow}, ${parts.date} · ${parts.range ?? parts.time}`
  return parts.zone === null ? when : `${when} ${parts.zone}`
}
