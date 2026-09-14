import { useMemo } from "react"
import { eventWhenParts, type EventWhenInput, type EventWhenParts } from "@civfix/shared/datetime"
import { useLocale } from "./LocaleContext"
import { useRelativeTime } from "./useRelativeTime"
import { useViewerTimeZone } from "./useViewerTimeZone"

export interface EventWhen extends EventWhenParts {
  timeZone: string | undefined
  timeWithZone: string
  rangeWithZone: string | null
}

function withZone(label: string, zone: string | null): string {
  return zone === null ? label : `${label} ${zone}`
}

export function useEventWhen(event: EventWhenInput): EventWhen {
  const { locale } = useLocale()
  const { weekdays } = useRelativeTime()
  const viewerTimeZone = useViewerTimeZone()
  const { scheduledAt, endsAt, timezone } = event
  return useMemo(() => {
    const parts = eventWhenParts(
      { scheduledAt, endsAt: endsAt ?? null, timezone: timezone ?? null },
      { locale, weekdays, viewerTimeZone },
    )
    return {
      ...parts,
      timeZone: timezone ?? undefined,
      timeWithZone: withZone(parts.time, parts.zone),
      rangeWithZone: parts.range === null ? null : withZone(parts.range, parts.zone),
    }
  }, [scheduledAt, endsAt, timezone, locale, weekdays, viewerTimeZone])
}
