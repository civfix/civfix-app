import { useMemo } from "react"
import { weekDayLabel } from "@civfix/shared/host"
import { useLocale } from "../../i18n"

export function useWeekLabel(): (day: string) => string {
  const { locale } = useLocale()
  return useMemo(() => weekDayLabel(locale), [locale])
}
