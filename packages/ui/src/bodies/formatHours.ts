/**
 * The ONE volunteer-hours number formatter in the package.
 *
 * Lifted verbatim out of `LeaderboardBody.tsx` so the leaderboard page, the Discovery leaderboard
 * preview, the profile hours surfaces and the per-attendee hours editor all print the same digits.
 * One decimal, always: "2" -> "2.0", "2.46" -> "2.5". Rounding happens BEFORE `toFixed` so the value
 * is rounded half-up on the tenth rather than through `toFixed`'s binary-floating-point rounding
 * (`(1.005).toFixed(2)` is the classic counter-example of why those two differ).
 *
 * TWO functions, because the two jobs pull in opposite directions:
 *
 *   formatHours(h)                 - MACHINE/ROUND-TRIP digits, always a period. `seedHoursDrafts` feeds
 *                                    this straight back into a `TextInput` that `parseHoursDraft` must be
 *                                    able to `Number()`, and a decimal comma would break that round trip.
 *   formatHoursDisplay(h, locale)  - READ-ONLY display digits for the four app locales. es/de write the
 *                                    decimal separator as a COMMA ("2,5 Std."), so printing "2.5" inside
 *                                    an otherwise fully-translated `{{hours}}` string was simply wrong.
 *
 * The separator comes from a two-entry map rather than `Intl.NumberFormat` on purpose: the display path
 * runs on Hermes, whose Intl surface varies by RN/ICU build, and the map keeps this module PURE (no
 * platform capability probe) and its output identical under vitest, web and native. The four supported
 * locales are en/es/de/ko; only es and de take the comma (ko and en use the period), and no grouping
 * separator is introduced - "1234.5" stays "1234,5", never "1.234,5" - so the digits keep parity with
 * what the leaderboard and the certificate already print.
 */
import type { SupportedLocale } from "@civfix/shared"

/** The app locales whose decimal separator is a comma (CLDR: es-ES, de-DE). en and ko use a period. */
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
