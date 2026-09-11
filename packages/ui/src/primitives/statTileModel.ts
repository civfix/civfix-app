import { FALLBACK_LOCALE } from "../i18n/resolveLocale"

export const STAT_VALUE_UNKNOWN = "—"

export const STAT_TILE_WIDE_AT = 480

export type StatTileColumns = 2 | 4

export function statTileColumns(width: number): StatTileColumns {
  return width >= STAT_TILE_WIDE_AT ? 4 : 2
}

export function formatStatValue(value: number | null, locale: string = FALLBACK_LOCALE): string | null {
  if (value === null || !Number.isFinite(value)) return null
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)
}

export function formatRate(rate: number | null, locale: string = FALLBACK_LOCALE): string | null {
  if (rate === null || !Number.isFinite(rate)) return null
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(rate)
}
