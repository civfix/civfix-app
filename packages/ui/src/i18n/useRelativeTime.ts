/**
 * useRelativeTime() — a localized wrapper over @civfix/shared's framework-neutral `relativeAgo`.
 *
 * The shared `relativeAgo` keeps English defaults ("now"/"m"/"h"/"d"/"w") so the contract package stays
 * i18next-free. This hook supplies the LOCALIZED labels — pulled from the `common-datetime` catalog
 * namespace (`just_now`, `unit_minute`/`hour`/`day`/`week`) for the active locale — and returns a
 * formatter `relative(date, now?)`. It also exposes the localized short `weekdays` array so callers that
 * render `dowLabel(iso, weekdays)` localize the event sub-line too.
 *
 * Empty/missing catalog values fall back to en (config sets returnEmptyString:false), so unauthored
 * locales still produce the English defaults rather than blanks.
 */
import { useCallback, useMemo } from "react"
import { relativeAgo, WEEKDAYS, type RelativeUnitLabels } from "@civfix/shared"
import { useTranslation } from "react-i18next"

export interface UseRelativeTime {
  /** Localized compact "ago" label (e.g. "5m", "hace 5 m"-style depending on the catalog). */
  relative: (date: Date | string | number, now?: Date | number) => string
  /** The active locale's short weekday labels, indexed by Date#getDay() (0 = Sunday). */
  weekdays: readonly string[]
  /** The just-now label for the active locale. */
  justNow: string
  /** The localized compact unit suffixes (minute/hour/day/week). */
  units: RelativeUnitLabels
}

export function useRelativeTime(): UseRelativeTime {
  const { t } = useTranslation("common-datetime")

  const justNow = t("just_now", { defaultValue: "now" })
  const units = useMemo<RelativeUnitLabels>(
    () => ({
      minute: t("unit_minute", { defaultValue: "m" }),
      hour: t("unit_hour", { defaultValue: "h" }),
      day: t("unit_day", { defaultValue: "d" }),
      week: t("unit_week", { defaultValue: "w" }),
    }),
    [t],
  )

  // `weekdays` is an ARRAY value; i18next returns it via returnObjects. Fall back to the shared English
  // WEEKDAYS when the catalog value is absent or not a 7-length array.
  const weekdays = useMemo<readonly string[]>(() => {
    const raw = t("weekdays", { returnObjects: true, defaultValue: WEEKDAYS as unknown as string[] })
    return Array.isArray(raw) && raw.length === 7 ? (raw as string[]) : WEEKDAYS
  }, [t])

  const relative = useCallback(
    (date: Date | string | number, now?: Date | number) =>
      relativeAgo(date, now, { justNow, units }),
    [justNow, units],
  )

  return { relative, weekdays, justNow, units }
}
