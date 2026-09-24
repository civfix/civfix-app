import React, { useCallback } from "react"
import { Platform } from "react-native"
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker"
import { useTheme } from "../theme"
import { Icon, iconMap } from "../typography"
import { useLocale } from "../i18n"
import { DateTimeFieldRow, InlineDateTimePickerLayout } from "./DateTimeFieldRow"
import { timeCarrier, uses24HourClock } from "./calendarModel"
import {
  TIME_PICKER_MINUTE_INTERVAL,
  type DateFieldRowProps,
  type InlineDateTimePickerProps,
  type TimeFieldRowProps,
} from "./InlineDateTimePicker.types"

const isAndroid = Platform.OS === "android"

function Caret() {
  const th = useTheme()
  return <Icon icon={iconMap.ChevronDown} size={16} color={th.colors.textSubtle} />
}

export function DateFieldRow({
  value,
  displayValue,
  placeholder,
  accessibilityLabel,
  onChange,
  minDate,
  label,
  error,
  spaced,
}: DateFieldRowProps) {
  const th = useTheme()
  const current = value ?? minDate ?? new Date()

  const commit = useCallback(
    (event: DateTimePickerEvent, picked?: Date) => {
      if (event.type === "dismissed" || picked === undefined) return
      onChange(new Date(picked.getFullYear(), picked.getMonth(), picked.getDate(), 12, 0, 0, 0))
    },
    [onChange],
  )

  const openDialog = useCallback(() => {
    DateTimePickerAndroid.open({
      value: current,
      mode: "date",
      display: "default",
      minimumDate: minDate ?? undefined,
      onChange: commit,
    })
  }, [commit, current, minDate])

  return (
    <DateTimeFieldRow
      icon={iconMap.Calendar}
      value={displayValue}
      placeholder={placeholder}
      accessibilityLabel={accessibilityLabel}
      label={label}
      error={error}
      spaced={spaced}
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

export function TimeFieldRow({
  value,
  displayValue,
  placeholder,
  accessibilityLabel,
  onChange,
  day,
  minTime,
  maxTime,
  minuteInterval,
  suffix,
  label,
  error,
  spaced,
}: TimeFieldRowProps) {
  const th = useTheme()
  const { locale } = useLocale()
  const base = day ?? new Date()
  const current = value ?? timeCarrier(base, base.getHours(), base.getMinutes())

  const commit = useCallback(
    (event: DateTimePickerEvent, picked?: Date) => {
      if (event.type === "dismissed" || picked === undefined) return
      onChange(timeCarrier(day ?? value ?? picked, picked.getHours(), picked.getMinutes()))
    },
    [day, onChange, value],
  )

  const openDialog = useCallback(() => {
    DateTimePickerAndroid.open({
      value: current,
      mode: "time",
      display: "default",
      is24Hour: uses24HourClock(locale),
      minuteInterval: minuteInterval ?? TIME_PICKER_MINUTE_INTERVAL,
      onChange: commit,
    })
  }, [commit, current, locale, minuteInterval])

  return (
    <DateTimeFieldRow
      icon={iconMap.Clock}
      value={displayValue}
      placeholder={placeholder}
      accessibilityLabel={accessibilityLabel}
      label={label}
      suffix={suffix}
      error={error}
      spaced={spaced}
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
