import React, { useCallback } from "react"
import { Platform } from "react-native"
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker"
import { useTheme } from "../theme"
import { Icon, iconMap } from "../typography"
import { useLocale } from "../i18n"
import { DateTimeFieldRow, fieldRowChrome } from "./DateTimeFieldRow"
import { InlineDateTimePickerLayout } from "./InlineDateTimePicker.shared"
import { timeCarrier, uses24HourClock } from "./calendarModel"
import {
  TIME_PICKER_MINUTE_INTERVAL,
  type DateFieldRowProps,
  type InlineDateTimePickerProps,
  type TimeFieldRowProps,
} from "./InlineDateTimePicker.types"

const isAndroid = Platform.OS === "android"

function pickerSeed(value: Date | null | undefined, fallback: Date | null | undefined): Date {
  return value ?? fallback ?? new Date()
}

// Seeded on the time carrier, not on `day`: the picker returns the seed's day with the picked clock, and
// on the device's spring-forward day a Date cannot hold a clock inside the gap.
function timePickerSeed(value: Date | null | undefined, day: Date | null | undefined): Date {
  const base = day ?? new Date()
  return value ?? timeCarrier(base, base.getHours(), base.getMinutes())
}

function Caret() {
  const th = useTheme()
  return <Icon icon={iconMap.ChevronDown} size={16} color={th.colors.textSubtle} />
}

export function DateFieldRow(props: DateFieldRowProps) {
  const { value, accessibilityLabel, onChange, minDate } = props
  const th = useTheme()
  const current = pickerSeed(value, minDate)

  const commit = useCallback(
    (event: DateTimePickerEvent, picked?: Date) => {
      if (event.type === "dismissed" || picked === undefined) return
      onChange(new Date(picked.getFullYear(), picked.getMonth(), picked.getDate(), 12, 0, 0, 0))
    },
    [onChange],
  )

  const openDialog = useCallback(() => {
    DateTimePickerAndroid.open({
      value: pickerSeed(value, minDate),
      mode: "date",
      display: "default",
      minimumDate: minDate ?? undefined,
      onChange: commit,
    })
  }, [commit, minDate, value])

  return (
    <DateTimeFieldRow
      icon={iconMap.Calendar}
      {...fieldRowChrome(props)}
      onPress={isAndroid ? openDialog : undefined}
      trailing={
        isAndroid ? (
          <Caret />
        ) : (
          <DateTimePicker
            accessibilityLabel={accessibilityLabel}
            mode="date"
            display="compact"
            value={current}
            minimumDate={minDate ?? undefined}
            accentColor={th.colors.brand.bloom}
            themeVariant={th.scheme}
            onChange={commit}
          />
        )
      }
    />
  )
}

export function TimeFieldRow(props: TimeFieldRowProps) {
  const { value, accessibilityLabel, onChange, day, minTime, maxTime, minuteInterval } = props
  const th = useTheme()
  const { locale } = useLocale()
  const current = timePickerSeed(value, day)

  const commit = useCallback(
    (event: DateTimePickerEvent, picked?: Date) => {
      if (event.type === "dismissed" || picked === undefined) return
      onChange(timeCarrier(day ?? value ?? picked, picked.getHours(), picked.getMinutes()))
    },
    [day, onChange, value],
  )

  const openDialog = useCallback(() => {
    DateTimePickerAndroid.open({
      value: timePickerSeed(value, day),
      mode: "time",
      display: "default",
      is24Hour: uses24HourClock(locale),
      minuteInterval: minuteInterval ?? TIME_PICKER_MINUTE_INTERVAL,
      onChange: commit,
    })
  }, [commit, day, locale, minuteInterval, value])

  return (
    <DateTimeFieldRow
      icon={iconMap.Clock}
      {...fieldRowChrome(props)}
      onPress={isAndroid ? openDialog : undefined}
      trailing={
        isAndroid ? (
          <Caret />
        ) : (
          <DateTimePicker
            accessibilityLabel={accessibilityLabel}
            mode="time"
            display="compact"
            value={current}
            minimumDate={minTime ?? undefined}
            maximumDate={maxTime ?? undefined}
            minuteInterval={minuteInterval ?? TIME_PICKER_MINUTE_INTERVAL}
            accentColor={th.colors.brand.bloom}
            themeVariant={th.scheme}
            onChange={commit}
          />
        )
      }
    />
  )
}

export function InlineDateTimePicker(props: InlineDateTimePickerProps) {
  return <InlineDateTimePickerLayout {...props} DateRow={DateFieldRow} TimeRow={TimeFieldRow} />
}
