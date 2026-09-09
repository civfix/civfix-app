import React, { useMemo, useState } from "react"
import { View, Pressable } from "react-native"
import {
  makeThemedStyles,
  useTheme,
  focusRingProps,
  webCursor,
  webCursorPointer,
  webTransition,
  webHover,
} from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useT, useLocale } from "../i18n"
import { isTimeSlotSelectable, timeSlots } from "./calendarModel"
import { MonthCalendarGrid } from "./MonthCalendarGrid"

type OpenMode = "date" | "time" | null

export interface InlineDateTimePickerProps {
  date: Date | null
  time: Date | null
  onDateChange: (next: Date) => void
  onTimeChange: (next: Date) => void
}

export function InlineDateTimePicker({ date, time, onDateChange, onTimeChange }: InlineDateTimePickerProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("common-datetime")
  const { locale } = useLocale()
  const [openMode, setOpenMode] = useState<OpenMode>(null)
  const [viewMonth, setViewMonth] = useState<{ year: number; month: number }>(() => {
    const seed = date ?? new Date()
    return { year: seed.getFullYear(), month: seed.getMonth() }
  })

  const slots = useMemo(() => timeSlots(locale), [locale])
  const now = new Date()

  const dateValue = date
    ? date.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" })
    : null
  const timeValue = time
    ? time.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })
    : null

  const dateText = dateValue ?? t("placeholder.pick_date")
  const timeText = timeValue ?? t("placeholder.pick_time")

  const toggle = (mode: "date" | "time") => {
    setOpenMode((prev) => (prev === mode ? null : mode))
  }

  const shiftMonth = (delta: number) => {
    setViewMonth((prev) => {
      const m = prev.month + delta
      const year = prev.year + Math.floor(m / 12)
      const month = ((m % 12) + 12) % 12
      return { year, month }
    })
  }

  const selectDay = (day: number) => {
    const next = new Date(date ?? new Date())
    next.setFullYear(viewMonth.year, viewMonth.month, day)
    onDateChange(next)
  }

  const selectTime = (hours: number, minutes: number) => {
    const next = new Date(date ?? time ?? new Date())
    next.setHours(hours, minutes, 0, 0)
    onTimeChange(next)
    setOpenMode(null)
  }

  return (
    <View>
      <Pressable
        onPress={() => toggle("date")}
        accessibilityRole="button"
        accessibilityLabel={t("a11y.date_field", { value: dateText })}
        accessibilityState={{ expanded: openMode === "date" }}
        {...focusRingProps}
        style={(state) => [
          styles.fieldRow,
          webCursorPointer,
          webTransition,
          webHover(state) ? styles.fieldRowHovered : null,
          state.pressed ? styles.pressed : null,
        ]}
      >
        <Icon icon={iconMap.Calendar} size={16} color={th.colors.textSubtle} />
        <Text numberOfLines={1} style={[styles.fieldValue, dateValue ? null : styles.fieldPlaceholder]}>
          {dateText}
        </Text>
        <View style={openMode === "date" ? styles.caretOpen : null}>
          <Icon icon={iconMap.ChevronDown} size={16} color={th.colors.textSubtle} />
        </View>
      </Pressable>

      {openMode === "date" ? (
        <View style={styles.panel}>
          <MonthCalendarGrid
            viewMonth={viewMonth}
            selected={date}
            onSelectDay={selectDay}
            onShiftMonth={shiftMonth}
          />
        </View>
      ) : null}

      <Pressable
        onPress={() => toggle("time")}
        accessibilityRole="button"
        accessibilityLabel={t("a11y.time_field", { value: timeText })}
        accessibilityState={{ expanded: openMode === "time" }}
        {...focusRingProps}
        style={(state) => [
          styles.fieldRow,
          styles.fieldRowSpaced,
          webCursorPointer,
          webTransition,
          webHover(state) ? styles.fieldRowHovered : null,
          state.pressed ? styles.pressed : null,
        ]}
      >
        <Icon icon={iconMap.Clock} size={16} color={th.colors.textSubtle} />
        <Text numberOfLines={1} style={[styles.fieldValue, timeValue ? null : styles.fieldPlaceholder]}>
          {timeText}
        </Text>
        <View style={openMode === "time" ? styles.caretOpen : null}>
          <Icon icon={iconMap.ChevronDown} size={16} color={th.colors.textSubtle} />
        </View>
      </Pressable>

      {openMode === "time" ? (
        <View style={styles.panel}>
          <View style={styles.timeGrid}>
            {slots.map((slot) => {
              const selectable = isTimeSlotSelectable(date, slot.hours, slot.minutes, now)
              const selected =
                time != null && time.getHours() === slot.hours && time.getMinutes() === slot.minutes
              return (
                <View key={slot.key} style={styles.timeCell}>
                  <Pressable
                    onPress={() => selectTime(slot.hours, slot.minutes)}
                    disabled={!selectable}
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled: !selectable }}
                    {...focusRingProps}
                    style={(state) => [
                      styles.timeChip,
                      webCursor(!selectable),
                      webTransition,
                      selected ? styles.timeChipSelected : null,
                      webHover(state) && selectable
                        ? selected
                          ? styles.timeChipSelectedHovered
                          : styles.chipPressed
                        : null,
                      state.pressed && !selected && selectable ? styles.chipPressed : null,
                    ]}
                  >
                    {selected ? (
                      <Icon icon={iconMap.Check} size={14} color={th.colors.brand.bloom} />
                    ) : null}
                    <Text
                      numberOfLines={1}
                      variant={selected ? "bodyStrong" : "body"}
                      color={
                        selected
                          ? th.colors.brand.bloom
                          : selectable
                            ? th.colors.text
                            : th.colors.textSubtle
                      }
                    >
                      {slot.label}
                    </Text>
                  </Pressable>
                </View>
              )
            })}
          </View>
        </View>
      ) : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    minHeight: 52,
    paddingHorizontal: t.space["4"],
  },
  fieldRowHovered: {
    backgroundColor: t.colors.surfaceTint,
    borderColor: t.colors.borderStrong,
  },
  fieldRowSpaced: {
    marginTop: t.space["2"],
  },
  fieldValue: {
    flex: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["15"],
    color: t.colors.text,
  },
  fieldPlaceholder: {
    color: t.colors.textSubtle,
  },
  caretOpen: {
    transform: [{ rotate: "180deg" }],
  },
  panel: {
    marginTop: t.space["2"],
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    paddingHorizontal: t.space["4"],
    paddingVertical: t.space["3"],
  },
  chipPressed: {
    backgroundColor: t.colors.bgAlt,
  },
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  timeCell: {
    width: `${100 / 3}%`,
    padding: 2,
  },
  timeChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: t.space["1"],
    minHeight: 44,
    paddingHorizontal: t.space["2"],
    borderRadius: t.radius.md,
  },
  timeChipSelected: {
    backgroundColor: t.colors.bloom["50"],
  },
  timeChipSelectedHovered: {
    backgroundColor: t.colors.bloom["100"],
  },
  pressed: {
    opacity: 0.85,
  },
}))
