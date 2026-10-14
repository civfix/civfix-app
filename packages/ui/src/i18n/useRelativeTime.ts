// The shared `relativeAgo` keeps English defaults so the contract package stays i18next-free; this hook
// supplies the localized labels.
import { useCallback, useMemo } from "react"
import { relativeAgo, WEEKDAYS, type RelativeUnitLabels } from "@civfix/shared"
import { useTranslation } from "react-i18next"

export interface UseRelativeTime {
  relative: (date: Date | string | number, now?: Date | number) => string
  /** Indexed by Date#getDay() (0 = Sunday). */
  weekdays: readonly string[]
  justNow: string
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
