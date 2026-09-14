import React, { useCallback, useMemo, useRef } from "react"
import { useTheme } from "../theme"
import { iconMap } from "../typography"
import { DateTimeFieldRow, InlineDateTimePickerLayout } from "./DateTimeFieldRow"
import {
  TIME_PICKER_MINUTE_INTERVAL,
  type DateFieldRowProps,
  type InlineDateTimePickerProps,
  type TimeFieldRowProps,
} from "./InlineDateTimePicker.types"

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

function dateInputValue(date: Date | null | undefined): string {
  if (!date) return ""
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function timeInputValue(time: Date | null | undefined): string {
  if (!time) return ""
  return `${pad(time.getHours())}:${pad(time.getMinutes())}`
}

function parseDateInput(raw: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if (match === null) return null
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

function parseTimeInput(raw: string): { hours: number; minutes: number } | null {
  const match = /^(\d{2}):(\d{2})/.exec(raw)
  if (match === null) return null
  return { hours: Number(match[1]), minutes: Number(match[2]) }
}

function useNativeInputStyle(): React.CSSProperties {
  const th = useTheme()
  return useMemo(
    () => ({
      flex: 1,
      minWidth: 0,
      appearance: "none",
      background: "transparent",
      border: "none",
      outline: "none",
      padding: 0,
      colorScheme: th.scheme,
      color: th.colors.text,
      fontFamily: th.fontFamily.bodyRegular,
      fontSize: th.fontSize["15"],
    }),
    [th],
  )
}

function useNativeInput() {
  const ref = useRef<HTMLInputElement | null>(null)
  const open = useCallback(() => {
    const input = ref.current
    if (input === null) return
    input.focus()
    input.showPicker?.()
  }, [])
  return { ref, open }
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
  const style = useNativeInputStyle()
  const { ref, open } = useNativeInput()

  return (
    <DateTimeFieldRow
      icon={iconMap.Calendar}
      value={displayValue}
      placeholder={placeholder}
      accessibilityLabel={accessibilityLabel}
      label={label}
      error={error}
      spaced={spaced}
      onPress={open}
      valueSlot={
        <input
          ref={ref}
          type="date"
          value={dateInputValue(value)}
          min={dateInputValue(minDate)}
          aria-label={accessibilityLabel}
          style={style}
          onChange={(event) => {
            const parsed = parseDateInput(event.target.value)
            if (parsed === null) return
            onChange(new Date(parsed.year, parsed.month - 1, parsed.day, 12, 0, 0, 0))
          }}
        />
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
  const style = useNativeInputStyle()
  const { ref, open } = useNativeInput()

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
      onPress={open}
      valueSlot={
        <input
          ref={ref}
          type="time"
          step={(minuteInterval ?? TIME_PICKER_MINUTE_INTERVAL) * 60}
          value={timeInputValue(value)}
          min={timeInputValue(minTime)}
          max={timeInputValue(maxTime)}
          aria-label={accessibilityLabel}
          style={style}
          onChange={(event) => {
            const parsed = parseTimeInput(event.target.value)
            if (parsed === null) return
            const next = new Date(day ?? value ?? new Date())
            next.setHours(parsed.hours, parsed.minutes, 0, 0)
            onChange(next)
          }}
        />
      }
    />
  )
}

export function InlineDateTimePicker(props: InlineDateTimePickerProps) {
  return <InlineDateTimePickerLayout {...props} DateRow={DateFieldRow} TimeRow={TimeFieldRow} />
}
