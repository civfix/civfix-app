/**
 * The one volunteer-hours formatter, so the leaderboard, the Discovery preview, the profile hours
 * surfaces and the per-attendee hours editor all print the same digits. One decimal, always ("2" ->
 * "2.0", "2.46" -> "2.5"). Rounding happens BEFORE `toFixed` so the tenth rounds half-up instead of
 * through `toFixed`'s binary floating-point rounding (`(1.005).toFixed(2)` is the classic counter-example).
 *
 * Two functions, because the jobs pull in opposite directions. `formatHours` always uses a period:
 * `seedHoursDrafts` feeds it back into a `TextInput` that `parseHoursDraft` must be able to `Number()`.
 * `formatHoursDisplay` is read-only and uses the locale's separator (es and de write a comma, "2,5 Std.").
 *
 * The separator comes from a two-entry map rather than `Intl.NumberFormat` on purpose: Hermes' Intl
 * surface varies by RN/ICU build, and the map keeps the output identical under vitest, web and native.
 * No grouping separator is added ("1234.5" becomes "1234,5", never "1.234,5") so the digits match what
 * the leaderboard and the certificate print.
 */
import type { SupportedLocale } from "@civfix/shared"

const DECIMAL_COMMA_LOCALES: readonly string[] = ["es", "de"]

export function formatHours(hours: number): string {
  return (Math.round(hours * 10) / 10).toFixed(1)
}

/**
 * The same one-decimal number, written the way the ACTIVE locale writes it. Use this everywhere hours are
 * rendered for reading (totals, chips, ledger rows, leaderboard rows, certificates, a11y labels) and keep
 * `formatHours` for the editor seed, which must stay `Number()`-parseable.
 */
export function formatHoursDisplay(hours: number, locale?: SupportedLocale | string): string {
  const digits = formatHours(hours)
  return locale && DECIMAL_COMMA_LOCALES.includes(locale) ? digits.replace(".", ",") : digits
}
