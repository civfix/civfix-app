import React, { useState } from "react"
import { View } from "react-native"
import { timeLabel, wallClockInZone, wallClockToInstantMs } from "@civfix/shared/datetime"
import { makeThemedStyles } from "../theme"
import { useLocale, useT } from "../i18n"
import { addWallClockDays, wallClockToFormDate } from "./calendarModel"
import { MIN_SLOT_DURATION_MS } from "./eventSlotsForm"
import { TimeFieldRow } from "./InlineDateTimePicker"
import { TIME_PICKER_MINUTE_INTERVAL } from "./InlineDateTimePicker.types"

export interface SlotWindowPickerProps {
  index: number
  eventStart: Date
  eventEnd: Date
  startsAt: Date
  endsAt: Date
  timeZone: string
  onChange: (next: { startsAt: Date; endsAt: Date }) => void
}

function carrierOf(instant: Date, timeZone: string): Date {
  return wallClockToFormDate(wallClockInZone(instant.getTime(), timeZone))
}

function clockOnEventDay(clock: Date, eventStart: Date, timeZone: string): number | null {
  const startWall = wallClockInZone(eventStart.getTime(), timeZone)
  const sameDay = { ...startWall, hours: clock.getHours(), minutes: clock.getMinutes() }
  const sameDayMs = wallClockToInstantMs(sameDay, timeZone)
  if (sameDayMs !== null && sameDayMs >= eventStart.getTime()) return sameDayMs
  return wallClockToInstantMs(addWallClockDays(sameDay, 1), timeZone)
}

function clampWindow(
  start: Date,
  previous: { startsAt: Date; endsAt: Date },
  eventEnd: Date,
): { startsAt: Date; endsAt: Date } {
  const duration = Math.max(
    MIN_SLOT_DURATION_MS,
    previous.endsAt.getTime() - previous.startsAt.getTime(),
  )
  const latest = eventEnd.getTime()
  const end = Math.min(latest, start.getTime() + duration)
  return {
    startsAt: start,
    endsAt: new Date(Math.max(end, Math.min(latest, start.getTime() + MIN_SLOT_DURATION_MS))),
  }
}

export function SlotWindowPicker({
  index,
  eventStart,
  eventEnd,
  startsAt,
  endsAt,
  timeZone,
  onChange,
}: SlotWindowPickerProps) {
  const styles = useStyles()
  const { t } = useT("event-slots")
  const { locale } = useLocale()
  // A refused pick is judged against the event window of that moment; once the host moves the event,
  // the old verdict no longer applies, so the error is keyed to the window it was raised against.
  const windowKey = `${eventStart.getTime()}|${eventEnd.getTime()}`
  const [refused, setRefused] = useState<{ edge: "start" | "end"; windowKey: string } | null>(null)
  const invalidEdge = refused?.windowKey === windowKey ? refused.edge : null
  const setInvalidEdge = (edge: "start" | "end" | null) =>
    setRefused(edge === null ? null : { edge, windowKey })

  const latestStart = eventEnd.getTime() - MIN_SLOT_DURATION_MS
  const earliestEnd = startsAt.getTime() + MIN_SLOT_DURATION_MS

  const outsideEvent = t("editor.window_outside_event")

  const commitStart = (picked: Date) => {
    const at = clockOnEventDay(picked, eventStart, timeZone)
    if (at === null || at < eventStart.getTime() || at > latestStart) {
      setInvalidEdge("start")
      return
    }
    setInvalidEdge(null)
    onChange(clampWindow(new Date(at), { startsAt, endsAt }, eventEnd))
  }

  const commitEnd = (picked: Date) => {
    const at = clockOnEventDay(picked, eventStart, timeZone)
    if (at === null || at > eventEnd.getTime() || at < earliestEnd) {
      setInvalidEdge("end")
      return
    }
    setInvalidEdge(null)
    onChange({ startsAt, endsAt: new Date(at) })
  }

  return (
    <View style={styles.wrap}>
      <TimeFieldRow
        value={carrierOf(startsAt, timeZone)}
        displayValue={timeLabel(startsAt.toISOString(), locale, timeZone)}
        placeholder={false}
        accessibilityLabel={t("editor.starts_a11y", { index })}
        onChange={commitStart}
        label={t("editor.starts_label")}
        day={carrierOf(startsAt, timeZone)}
        minTime={carrierOf(eventStart, timeZone)}
        maxTime={carrierOf(new Date(latestStart), timeZone)}
        minuteInterval={TIME_PICKER_MINUTE_INTERVAL}
        error={invalidEdge === "start" ? outsideEvent : null}
      />
      <TimeFieldRow
        value={carrierOf(endsAt, timeZone)}
        displayValue={timeLabel(endsAt.toISOString(), locale, timeZone)}
        placeholder={false}
        accessibilityLabel={t("editor.ends_a11y", { index })}
        onChange={commitEnd}
        label={t("editor.ends_label")}
        day={carrierOf(endsAt, timeZone)}
        minTime={carrierOf(new Date(earliestEnd), timeZone)}
        maxTime={carrierOf(eventEnd, timeZone)}
        minuteInterval={TIME_PICKER_MINUTE_INTERVAL}
        error={invalidEdge === "end" ? outsideEvent : null}
      />
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  wrap: {
    gap: t.space["2"],
  },
}))
