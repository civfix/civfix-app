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
import { uses24HourClock } from "./calendarModel"
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
  const current = pickerSeed(value, day)

  const commit = useCallback(
    (event: DateTimePickerEvent, picked?: Date) => {
      if (event.type === "dismissed" || picked === undefined) return
      const next = new Date(day ?? value ?? picked)
      next.setHours(picked.getHours(), picked.getMinutes(), 0, 0)
      onChange(next)
    },
    [day, onChange, value],
  )

  const openDialog = useCallback(() => {
    DateTimePickerAndroid.open({
      value: pickerSeed(value, day),
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
