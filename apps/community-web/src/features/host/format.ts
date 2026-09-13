"use client"

import { useCallback, useMemo } from "react"
import { isValidTimeZone, sameOffsetAt, zoneShortName } from "@civfix/shared/datetime"
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
