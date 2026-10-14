import { FORMAT_FALLBACK_LOCALE } from "./internal/format-locale.js"

export interface FormatCountOptions {
  /** "12K" instead of "12,400": short labels on dense surfaces (post actions, chart axes). */
  compact?: boolean
}

interface CountFormatter {
  format: Intl.NumberFormat
  /** False on an engine that ignored `notation: "compact"` (read once, not per render). */
  compactHonoured: boolean
}

const countFormatters = new Map<string, CountFormatter>()

function makeCountFormatter(locale: string, compact: boolean): Intl.NumberFormat {
  const options: Intl.NumberFormatOptions = compact
    ? { notation: "compact" }
    : { maximumFractionDigits: 0 }
  try {
    return new Intl.NumberFormat(locale, options)
  } catch {
    return new Intl.NumberFormat(FORMAT_FALLBACK_LOCALE, options)
  }
}

// Intl constructors are costly on Hermes and counts render per feed row, so instances are cached.
function countFormatter(locale: string, compact: boolean): CountFormatter {
  const key = `${locale}|${compact ? "compact" : "whole"}`
  const cached = countFormatters.get(key)
  if (cached !== undefined) return cached
  const format = makeCountFormatter(locale, compact)
  const made = { format, compactHonoured: format.resolvedOptions().notation === "compact" }
  countFormatters.set(key, made)
  return made
}

const COMPACT_UNITS: readonly (readonly [number, string])[] = [
  [1_000_000_000, "B"],
  [1_000_000, "M"],
  [1_000, "K"],
]

const COMPACT_SINGLE_DECIMAL_BELOW = 10

// Hermes documents `notation: "compact"` as unsupported on Android below API 30, where the full
// number ("12,400") would overflow a feed row sized for "12K". An engine that did not honour the
// option says so in `resolvedOptions`, and the English short scale keeps the label short.
function englishCompact(value: number): string {
  const magnitude = Math.abs(value)
  for (const [divisor, suffix] of COMPACT_UNITS) {
    if (magnitude < divisor) continue
    const scaled = value / divisor
    const digits = Math.abs(scaled) < COMPACT_SINGLE_DECIMAL_BELOW ? 1 : 0
    return `${Number(scaled.toFixed(digits))}${suffix}`
  }
  return String(Math.round(value))
}

/**
 * A count in the viewer's locale: whole numbers ("12,400"), or with `compact` the locale's short
 * scale ("12K", "1,3 Mio.", "1.2만"), which rounds to two significant digits below ten units.
 */
export function formatCount(value: number, locale: string, options: FormatCountOptions = {}): string {
  const compact = options.compact === true
  const formatter = countFormatter(locale, compact)
  if (compact && !formatter.compactHonoured) return englishCompact(value)
  return formatter.format.format(value)
}

const CERTIFICATE_HOURS_MAX_FRACTION_DIGITS = 2

/**
 * The one hours format for a service-hours certificate, so the PDF's prose and the public verify page
 * show a registrar the same total (the backend's PDF table still prints two fixed decimals).
 */
export function formatCertificateHours(hours: number, locale: string): string {
  const options: Intl.NumberFormatOptions = {
    minimumFractionDigits: Number.isInteger(hours) ? 0 : 1,
    maximumFractionDigits: CERTIFICATE_HOURS_MAX_FRACTION_DIGITS,
  }
  try {
    return new Intl.NumberFormat(locale, options).format(hours)
  } catch {
    // An unsupported locale tag must not blank the verdict or the document.
    return String(hours)
  }
}
