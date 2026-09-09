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
export function eventChip(iso: string, locale?: string): { day: string; month: string } {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { day: "--", month: "--" }
  return {
    day: String(d.getDate()),
    month: d.toLocaleDateString(locale, { month: "short" }).toUpperCase(),
  }
}

/**
 * Short weekday like "Sat" for an event sub line (design `.pi-ev-card .meta .s`). "" if invalid.
 *
 * `weekdays` (optional) is a 7-length array of localized short weekday labels indexed by
 * `Date#getDay()` (0 = Sunday); omitted, the English `WEEKDAYS` default is used so existing callers are
 * unchanged. The `@civfix/ui` layer passes the active locale's labels from the `common-datetime` catalog.
 */
export function dowLabel(iso: string, weekdays?: readonly string[]): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const labels = weekdays ?? WEEKDAYS
  return labels[d.getDay()] ?? ""
}

/**
 * Time of day like "9:00 AM". "" for an invalid input. `locale` (optional BCP-47 tag) localizes the
 * clock format via the platform `Intl`; omitted uses the host default, so existing callers are unchanged.
 */
export function timeLabel(iso: string, locale?: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })
}
