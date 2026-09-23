"use client"

import { useCallback, useMemo } from "react"
import {
  isValidTimeZone,
  sameOffsetAt,
  wallClockInZone,
  wallClockToInstantMs,
  zoneShortName,
  type WallClock,
} from "@civfix/shared/datetime"
import { useLocale, useViewerTimeZone } from "@civfix/ui/i18n"

export interface ConsoleFormatters {
  locale: string
  number: (value: number) => string
  percent: (value: number) => string
  money: (amountMinor: number, currency?: string) => string
  date: (iso: string, timeZone?: string) => string
  dateTime: (iso: string, timeZone?: string) => string
  time: (iso: string, timeZone?: string) => string
  dayShort: (iso: string, timeZone?: string) => string
  zoneLabel: (iso: string, timeZone?: string) => string | null
  whenLabel: (iso: string, timeZone?: string) => string
}

const MINOR_UNITS = 100

/** The visible "no value" mark; JSX should render `EmptyValue`, which also names it for readers. */
export const EMPTY_VALUE = "\u2014"

export function formatMoneyMinor(
  amountMinor: number,
  currency: string,
  locale: string,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / MINOR_UNITS)
}

export function useConsoleFormat(timeZone?: string): ConsoleFormatters {
  const { locale } = useLocale()
  const viewerTimeZone = useViewerTimeZone()
  const zoneOf = useCallback(
    (override: string | undefined) => {
      const zone = override ?? timeZone
      return zone !== undefined && isValidTimeZone(zone) ? zone : undefined
    },
    [timeZone],
  )

  const number = useCallback(
    (value: number) => new Intl.NumberFormat(locale).format(value),
    [locale],
  )
  const percent = useCallback(
    (value: number) =>
      new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(value),
    [locale],
  )
  const money = useCallback(
    (amountMinor: number, currency = "USD") => formatMoneyMinor(amountMinor, currency, locale),
    [locale],
  )
  const date = useCallback(
    (iso: string, override?: string) =>
      new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: zoneOf(override) }).format(
        new Date(iso),
      ),
    [locale, zoneOf],
  )
  const dateTime = useCallback(
    (iso: string, override?: string) =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: zoneOf(override),
      }).format(new Date(iso)),
    [locale, zoneOf],
  )
  const time = useCallback(
    (iso: string, override?: string) =>
      new Intl.DateTimeFormat(locale, { timeStyle: "short", timeZone: zoneOf(override) }).format(
        new Date(iso),
      ),
    [locale, zoneOf],
  )
  const dayShort = useCallback(
    (iso: string, override?: string) =>
      new Intl.DateTimeFormat(locale, {
        month: "short",
        day: "numeric",
        timeZone: zoneOf(override),
      }).format(new Date(iso)),
    [locale, zoneOf],
  )
  const zoneLabel = useCallback(
    (iso: string, override?: string) => {
      const zone = zoneOf(override)
      if (zone === undefined) return null
      const at = new Date(iso).getTime()
      if (Number.isNaN(at) || sameOffsetAt(at, zone, viewerTimeZone)) return null
      const short = zoneShortName(at, zone, locale)
      return short === "" ? null : short
    },
    [locale, viewerTimeZone, zoneOf],
  )

  const whenLabel = useCallback(
    (iso: string, override?: string) => {
      const zone = zoneLabel(iso, override)
      const when = dateTime(iso, override)
      return zone === null ? when : `${when} ${zone}`
    },
    [dateTime, zoneLabel],
  )

  return useMemo(
    () => ({ locale, number, percent, money, date, dateTime, time, dayShort, zoneLabel, whenLabel }),
    [locale, number, percent, money, date, dateTime, time, dayShort, zoneLabel, whenLabel],
  )
}

export function seriesDayLabel(day: string, locale: string): string {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(`${day}T00:00:00Z`) : new Date(day)
  if (Number.isNaN(parsed.getTime())) return day
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed)
}

const pad = (value: number, width = 2) => String(value).padStart(width, "0")

/**
 * The zone a console `datetime-local` input is read and written in: the event's own zone, so a
 * host editing from another zone sees the same wall clock the attendees do; the viewer's zone only
 * for a legacy event with no (or an unusable) zone.
 */
export function consoleInputZone(eventZone: string | null | undefined, viewerZone: string): string {
  return eventZone && isValidTimeZone(eventZone) ? eventZone : viewerZone
}

export function useConsoleInputZone(eventZone: string | null | undefined): string {
  return consoleInputZone(eventZone, useViewerTimeZone())
}

export function isoToZonedInput(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return ""
  const at = Date.parse(iso)
  if (Number.isNaN(at)) return ""
  const wall = wallClockInZone(at, timeZone)
  const date = `${pad(wall.year, 4)}-${pad(wall.month)}-${pad(wall.day)}`
  return `${date}T${pad(wall.hours)}:${pad(wall.minutes)}`
}

export type ZonedInputValue =
  | { kind: "empty" }
  | { kind: "instant"; iso: string }
  | { kind: "invalid" }

const DATETIME_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/

/**
 * `invalid` covers both a malformed value and a wall clock that does not exist in the zone (the
 * hour skipped by a spring-forward DST change), which the caller must surface as a field error
 * rather than silently shifting.
 */
export function zonedInputToIso(value: string, timeZone: string): ZonedInputValue {
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

export interface ZonedFieldPatch<K extends string> {
  patch: Partial<Record<K, string | null>>
  invalid: K[]
}

/**
 * Converts datetime-local inputs back to instants for a save. With `saved` given, a field the host
 * did not touch is left out, so saving an unrelated setting can never move a stored time.
 */
export function zonedFieldPatch<K extends string>(
  saved: Readonly<Record<K, string>> | null,
  current: Readonly<Record<K, string>>,
  timeZone: string,
): ZonedFieldPatch<K> {
  const result: ZonedFieldPatch<K> = { patch: {}, invalid: [] }
  for (const field of Object.keys(current) as K[]) {
    if (saved !== null && current[field] === saved[field]) continue
    const parsed = zonedInputToIso(current[field], timeZone)
    if (parsed.kind === "invalid") result.invalid.push(field)
    else result.patch[field] = parsed.kind === "instant" ? parsed.iso : null
  }
  return result
}
