import { useMemo } from "react"
import { useLocale } from "../../i18n"
import { weekDayLabel } from "./analyticsModel"

export function useWeekLabel(): (day: string) => string {
  const { locale } = useLocale()
  return useMemo(() => weekDayLabel(locale), [locale])
}
