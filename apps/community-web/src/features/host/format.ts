"use client"

import { useCallback, useMemo } from "react"
import { useLocale } from "@civfix/ui/i18n"

export interface ConsoleFormatters {
  locale: string
  number: (value: number) => string
  percent: (value: number) => string
  money: (amountMinor: number, currency?: string) => string
  date: (iso: string) => string
  dateTime: (iso: string) => string
  time: (iso: string) => string
  dayShort: (iso: string) => string
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

export function useConsoleFormat(): ConsoleFormatters {
  const { locale } = useLocale()

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
    (iso: string) =>
      new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(iso)),
    [locale],
  )
  const dateTime = useCallback(
    (iso: string) =>
      new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(iso),
      ),
    [locale],
  )
  const time = useCallback(
    (iso: string) =>
      new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(new Date(iso)),
    [locale],
  )
  const dayShort = useCallback(
    (iso: string) =>
      new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(new Date(iso)),
    [locale],
  )

  return useMemo(
    () => ({ locale, number, percent, money, date, dateTime, time, dayShort }),
    [locale, number, percent, money, date, dateTime, time, dayShort],
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
