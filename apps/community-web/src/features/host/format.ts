"use client"

import { useCallback, useMemo } from "react"
import {
  isoFromDatetimeLocal,
  isValidTimeZone,
  safeDateFormat,
  sameOffsetAt,
  zoneShortName,
} from "@civfix/shared/datetime"
import { useLocale, useViewerTimeZone } from "@civfix/ui/i18n"

export interface ConsoleFormatters {
  locale: string
  number: (value: number) => string
  percent: (value: number) => string
  date: (iso: string, timeZone?: string) => string
  dateTime: (iso: string, timeZone?: string) => string
  time: (iso: string, timeZone?: string) => string
  dayShort: (iso: string, timeZone?: string) => string
  zoneLabel: (iso: string, timeZone?: string) => string | null
  whenLabel: (iso: string, timeZone?: string) => string
}

/** The visible "no value" mark; JSX should render `EmptyValue`, which also names it for readers. */
export { EMPTY_VALUE } from "@civfix/ui/i18n"

interface LocaleNumberFormats {
  number: Intl.NumberFormat
  percent: Intl.NumberFormat
}

const numberFormatsByLocale = new Map<string, LocaleNumberFormats>()

// Console tables format a number per cell, and building an Intl.NumberFormat costs far more than
// formatting with one; the key space is the supported locale set.
function localeNumberFormats(locale: string): LocaleNumberFormats {
  const cached = numberFormatsByLocale.get(locale)
  if (cached !== undefined) return cached
  const made = {
    number: new Intl.NumberFormat(locale),
    percent: new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }),
  }
  numberFormatsByLocale.set(locale, made)
  return made
}

const DATE_OPTIONS: Intl.DateTimeFormatOptions = { dateStyle: "medium" }
const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }
const TIME_OPTIONS: Intl.DateTimeFormatOptions = { timeStyle: "short" }
const DAY_SHORT_OPTIONS: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }

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
    (value: number) => localeNumberFormats(locale).number.format(value),
    [locale],
  )
  const percent = useCallback(
    (value: number) => localeNumberFormats(locale).percent.format(value),
    [locale],
  )
  const date = useCallback(
    (iso: string, override?: string) => safeDateFormat(iso, locale, DATE_OPTIONS, zoneOf(override)),
    [locale, zoneOf],
  )
  const dateTime = useCallback(
    (iso: string, override?: string) =>
      safeDateFormat(iso, locale, DATE_TIME_OPTIONS, zoneOf(override)),
    [locale, zoneOf],
  )
  const time = useCallback(
    (iso: string, override?: string) => safeDateFormat(iso, locale, TIME_OPTIONS, zoneOf(override)),
    [locale, zoneOf],
  )
  const dayShort = useCallback(
    (iso: string, override?: string) =>
      safeDateFormat(iso, locale, DAY_SHORT_OPTIONS, zoneOf(override)),
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
    () => ({ locale, number, percent, date, dateTime, time, dayShort, zoneLabel, whenLabel }),
    [locale, number, percent, date, dateTime, time, dayShort, zoneLabel, whenLabel],
  )
}

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

/**
 * The zone's generic name ("Pacific Time"). A short name like PDT is right on one side of a DST
 * change only, so a label taken at another instant (today, the event start) can contradict the time
 * typed into the input it describes.
 */
export function zoneGenericName(timeZone: string, locale: string): string {
  if (!isValidTimeZone(timeZone)) return timeZone
  const name = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "longGeneric" })
    .formatToParts(0)
    .find((part) => part.type === "timeZoneName")?.value
  return name || timeZone
}

/** Null when the viewer reads every relevant instant at the input zone's offset. */
export function inputZoneHintName(
  timeZone: string,
  viewerZone: string,
  instantsMs: readonly number[],
  locale: string,
): string | null {
  const differs = instantsMs.some((at) => !sameOffsetAt(at, timeZone, viewerZone))
  return differs ? zoneGenericName(timeZone, locale) : null
}

/**
 * `name` labels errors about the zone; `hint` is null when the viewer's own clock already matches
 * the zone now, at `reference`, and at every time currently typed into `inputs`.
 */
export function useInputZoneNames(
  timeZone: string,
  inputs: readonly string[],
  reference?: string | null,
): { name: string; hint: string | null } {
  const { locale } = useLocale()
  const viewerTimeZone = useViewerTimeZone()
  const instants = [Date.now()]
  const referenceMs = reference ? Date.parse(reference) : Number.NaN
  if (!Number.isNaN(referenceMs)) instants.push(referenceMs)
  for (const input of inputs) {
    const parsed = isoFromDatetimeLocal(input, timeZone)
    if (parsed.kind === "instant") instants.push(Date.parse(parsed.iso))
  }
  return {
    name: zoneGenericName(timeZone, locale),
    hint: inputZoneHintName(timeZone, viewerTimeZone, instants, locale),
  }
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
    const parsed = isoFromDatetimeLocal(current[field], timeZone)
    if (parsed.kind === "invalid") result.invalid.push(field)
    else result.patch[field] = parsed.kind === "instant" ? parsed.iso : null
  }
  return result
}
