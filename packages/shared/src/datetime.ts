import { FORMAT_FALLBACK_LOCALE } from "./internal/format-locale.js"

/**
 * The compact "ago" label, shared so the server and both clients produce identical text.
 *
 * Thresholds:
 *   - future or < 60 seconds ago  -> "now"
 *   - < 60 minutes                -> "<N>m"   (whole minutes, floored)
 *   - < 24 hours                  -> "<N>h"   (whole hours, floored)
 *   - < 7 days                    -> "<N>d"   (whole days, floored)
 *   - >= 7 days                   -> "<N>w"   (whole weeks, floored) by default, OR an absolute date
 *                                    string when an `absoluteFallback` formatter is supplied.
 *
 * The core stays Intl-free so it runs on the most minimal RN engine; a caller that wants an absolute
 * date past one week passes an Intl formatter as `absoluteFallback`. `now` is injectable for
 * deterministic tests, and an unparseable input yields "" so a bad timestamp never throws in a render
 * path.
 */

/**
 * Compact unit suffixes appended to the floored count, e.g. `${n}${units.minute}`. The UI layer passes
 * localized ones; a caller that omits them gets the English `DEFAULT_RELATIVE_UNITS`.
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
  /** Localized unit suffixes; any omitted one falls back to `DEFAULT_RELATIVE_UNITS`. */
  units?: Partial<RelativeUnitLabels>
  /** Absolute formatter used past the one-week threshold instead of "<N>w". Receives the parsed Date. */
  absoluteFallback?: (d: Date) => string
}

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

function toEpochMs(value: Date | string | number): number | null {
  if (value instanceof Date) {
    const t = value.getTime()
    return Number.isNaN(t) ? null : t
  }
  if (typeof value === "number") {
    // Infinity and out-of-range epochs are not real times: they would render as "now" or reach
    // absoluteFallback as an Invalid Date.
    return Number.isNaN(new Date(value).getTime()) ? null : value
  }
  const t = Date.parse(value)
  return Number.isNaN(t) ? null : t
}

/** Compact relative-time label (thresholds in the module header). `now` defaults to `Date.now()`. */
export function relativeAgo(
  date: Date | string | number,
  now?: Date | number,
  opts?: RelativeAgoOptions,
): string {
  const fromMs = toEpochMs(date)
  if (fromMs === null) return ""
  const nowMs = now === undefined ? Date.now() : now instanceof Date ? now.getTime() : now
  if (!Number.isFinite(nowMs)) return ""

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

const MAX_CACHED_FORMATTERS = 64

// Keys come from caller strings (row zones, locale tags) and the zone picker sweeps every IANA zone
// through zoneShortName, so evicting the oldest entry keeps each cache bounded.
function remember<V>(cache: Map<string, V>, key: string, value: V): V {
  if (cache.size >= MAX_CACHED_FORMATTERS) {
    const oldest = cache.keys().next()
    if (oldest.done !== true) cache.delete(oldest.value)
  }
  cache.set(key, value)
  return value
}

const rowFormatters = new Map<string, Intl.DateTimeFormat>()
const zoneNameFormatters = new Map<string, Intl.DateTimeFormat>()

// Constructing an Intl.DateTimeFormat is one of the costlier built-ins on Hermes, and list rows format
// on every render. Only a formatter with an explicit locale and zone is cached: one built from the
// host defaults pins the device zone and language at first use, while getDay/getHours keep following
// the live device settings. A failed construction throws exactly as `new` does and is never cached.
function dateTimeFormat(
  cache: Map<string, Intl.DateTimeFormat>,
  locale: string | undefined,
  timeZone: string | undefined,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  if (locale === undefined || timeZone === undefined) {
    return new Intl.DateTimeFormat(
      locale,
      timeZone === undefined ? options : { ...options, timeZone },
    )
  }
  const key = JSON.stringify([locale, timeZone, options])
  const cached = cache.get(key)
  if (cached !== undefined) return cached
  return remember(cache, key, new Intl.DateTimeFormat(locale, { ...options, timeZone }))
}

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
  return remember(zoneFormatters, timeZone, formatter)
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

const ZONE_NAME_OPTIONS: Intl.DateTimeFormatOptions = { timeZoneName: "short" }

export function zoneShortName(instantMs: number, timeZone: string, locale?: string): string {
  const date = new Date(instantMs)
  if (Number.isNaN(date.getTime())) return ""
  try {
    const formatter = dateTimeFormat(zoneNameFormatters, locale, timeZone, ZONE_NAME_OPTIONS)
    return formatter.formatToParts(date).find((p) => p.type === "timeZoneName")?.value ?? ""
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
 * Unlike `relativeAgo`, the calendar/clock helpers below are locale formatters and depend on the
 * platform `Intl`, which every target provides (Node, Hermes/JSC, every browser). Each returns a
 * benign placeholder for an unparseable input instead of throwing in a render path.
 */

/**
 * English short weekday labels indexed by `Date#getDay()` (0 = Sunday). Callers localize by passing a
 * 7-length array to `dowLabel`.
 */
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

const CHIP_MONTH_OPTIONS: Intl.DateTimeFormatOptions = { month: "short" }
const WHEN_DATE_OPTIONS: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }

/**
 * `{ day, month }` for an event date chip: a day number over an uppercase short month
 * (e.g. `{ day: "30", month: "MAY" }`), or "--"/"--" for an invalid input. `locale` (a BCP-47 tag)
 * selects the month's language; omitted, the host default applies.
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
    month: dateTimeFormat(rowFormatters, locale, zone, CHIP_MONTH_OPTIONS).format(d).toUpperCase(),
  }
}

/**
 * Short weekday like "Sat", or "" for an invalid input. `weekdays` is a 7-length localized array
 * indexed by `Date#getDay()`; omitted, `WEEKDAYS` applies.
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

const WEEKDAY_OPTIONS: Intl.DateTimeFormatOptions = { weekday: "short" }

function weekdayIndex(date: Date, timeZone: string | undefined): number {
  if (timeZone === undefined) return date.getDay()
  const short = dateTimeFormat(rowFormatters, "en-US", timeZone, WEEKDAY_OPTIONS).format(date)
  const index = WEEKDAYS.indexOf(short as (typeof WEEKDAYS)[number])
  return index === -1 ? date.getDay() : index
}

/**
 * Time of day like "9:00 AM", or "" for an invalid input. `locale` (a BCP-47 tag) localizes the clock
 * format; omitted, the host default applies.
 */
export function timeLabel(iso: string, locale?: string, timeZone?: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return clockFormatter(locale, timeZone).format(d)
}

// Equivalent to `toLocaleTimeString(locale, CLOCK_OPTIONS)`, as the month options above are to
// `toLocaleDateString`: with a field of the required kind present no defaults are added, so the output
// and the RangeError for a bad locale are the same.
const CLOCK_OPTIONS: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" }

function clockFormatter(
  locale: string | undefined,
  timeZone: string | undefined,
): Intl.DateTimeFormat {
  return dateTimeFormat(rowFormatters, locale, usableZone(timeZone), CLOCK_OPTIONS)
}

const TIME_RANGE_SEPARATOR = " – "

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
  const clock = clockFormatter(locale, timeZone)
  const startLabel = clock.format(start)
  const endLabel = clock.format(end)
  const startParts = clock.formatToParts(start)
  const dayPeriod = dayPeriodOf(startParts)
  if (dayPeriod !== null && dayPeriod === dayPeriodOf(clock.formatToParts(end))) {
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

/**
 * The event zone's short name ("EDT") to append to a clock the viewer reads in another offset, or
 * null when either zone is missing or unusable or both read the same offset at that instant.
 */
export function eventZoneSuffix(
  instantMs: number,
  eventZone: string | null | undefined,
  viewerZone: string | null | undefined,
  locale: string | undefined,
): string | null {
  const event = usableZone(eventZone)
  const viewer = usableZone(viewerZone)
  if (event === undefined || viewer === undefined) return null
  if (sameOffsetAt(instantMs, event, viewer)) return null
  const short = zoneShortName(instantMs, event, locale)
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
    date: dateTimeFormat(rowFormatters, locale, zone, WHEN_DATE_OPTIONS).format(start),
    time: timeLabel(event.scheduledAt, locale, zone),
    range: hasEnd ? spanLabel(event.scheduledAt, endIso, locale, weekdays, zone) : null,
    zone: eventZoneSuffix(start.getTime(), zone, opts.viewerTimeZone, locale),
  }
}

export function eventWhenLabel(event: EventWhenInput, opts: EventWhenOptions = {}): string {
  const parts = eventWhenParts(event, opts)
  if (parts.time === "") return ""
  const when = `${parts.dow}, ${parts.date} · ${parts.range ?? parts.time}`
  return parts.zone === null ? when : `${when} ${parts.zone}`
}

const dateFormatters = new Map<string, Intl.DateTimeFormat>()

// Unlike `dateTimeFormat`, a malformed locale degrades to en-US so safeDateFormat never throws in a
// render path, and the fallback is cached under the requested locale so a bad preference fails once.
function cachedDateFormatter(
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions,
  timeZone: string | undefined,
): Intl.DateTimeFormat {
  const cacheable = locale !== undefined && timeZone !== undefined
  const key = JSON.stringify([locale, timeZone, options])
  const cached = cacheable ? dateFormatters.get(key) : undefined
  if (cached !== undefined) return cached
  const zoned = timeZone === undefined ? options : { ...options, timeZone }
  let made: Intl.DateTimeFormat
  try {
    made = new Intl.DateTimeFormat(locale, zoned)
  } catch {
    made = new Intl.DateTimeFormat(FORMAT_FALLBACK_LOCALE, zoned)
  }
  return cacheable ? remember(dateFormatters, key, made) : made
}

/**
 * Formats an instant with `options`, or "" when it is missing or unparseable. An unusable zone is
 * dropped (the viewer's zone applies) while the locale stays, so one malformed row never flips a
 * screen to English; a malformed locale falls back to en-US instead of throwing in a render path.
 */
export function safeDateFormat(
  iso: string | null | undefined,
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions,
  timeZone?: string | null,
): string {
  if (!iso) return ""
  const at = Date.parse(iso)
  if (Number.isNaN(at)) return ""
  return cachedDateFormatter(locale, options, usableZone(timeZone)).format(at)
}

/**
 * The zone an event with no usable zone of its own is shown in. Link previews render on a server
 * whose clock is UTC, so "the viewer's zone" is not available there; civfix launched in Los Angeles
 * and legacy rows predate per-event zones.
 */
const DEFAULT_EVENT_TIME_ZONE = "America/Los_Angeles"

export type EventInstantStyle = "short" | "long"

const EVENT_INSTANT_OPTIONS: Readonly<Record<EventInstantStyle, Intl.DateTimeFormatOptions>> = {
  short: {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  },
  long: {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  },
}

/**
 * One self-contained event instant ("Sat, Sep 12, 10:00 AM PDT"), labelled with its zone so it reads
 * correctly wherever it is shown. "" for a missing or unparseable instant.
 */
export function formatEventInstant(
  iso: string | null | undefined,
  timeZone: string | null | undefined,
  style: EventInstantStyle,
  locale: string = FORMAT_FALLBACK_LOCALE,
): string {
  return safeDateFormat(
    iso,
    locale,
    EVENT_INSTANT_OPTIONS[style],
    usableZone(timeZone) ?? DEFAULT_EVENT_TIME_ZONE,
  )
}

const pad = (value: number, width = 2) => String(value).padStart(width, "0")

/** The `<input type="datetime-local">` value showing `iso` on `timeZone`'s wall clock, or "". */
export function datetimeLocalFromIso(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return ""
  const at = Date.parse(iso)
  if (Number.isNaN(at)) return ""
  const wall = wallClockInZone(at, timeZone)
  const date = `${pad(wall.year, 4)}-${pad(wall.month)}-${pad(wall.day)}`
  return `${date}T${pad(wall.hours)}:${pad(wall.minutes)}`
}

export type DatetimeLocalValue =
  | { kind: "empty" }
  | { kind: "instant"; iso: string }
  | { kind: "invalid" }

const DATETIME_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/

/**
 * `invalid` covers both a malformed value and a wall clock that does not exist in the zone (the
 * hour skipped by a spring-forward DST change), which the caller must surface as a field error
 * rather than silently shifting.
 */
export function isoFromDatetimeLocal(value: string, timeZone: string): DatetimeLocalValue {
  if (value === "") return { kind: "empty" }
  const match = DATETIME_LOCAL.exec(value)
  if (!match) return { kind: "invalid" }
  const wall: WallClock = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hours: Number(match[4]),
    minutes: Number(match[5]),
  }
  const at = wallClockToInstantMs(wall, timeZone)
  return at === null ? { kind: "invalid" } : { kind: "instant", iso: new Date(at).toISOString() }
}
