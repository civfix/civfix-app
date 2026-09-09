import React, { useMemo } from "react"
import { View, Pressable } from "react-native"
import { makeThemedStyles, useTheme, focusRingProps, webCursor, webCursorPointer, webTransition, webHover } from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useT, useLocale } from "../i18n"
import { monthGrid, rotateWeekdays, sameDay, startOfDay, weekStartForLocale } from "./calendarModel"

export interface MonthCalendarGridProps {
  viewMonth: { year: number; month: number }
  selected: Date | null
  onSelectDay: (day: number) => void
  onShiftMonth: (delta: number) => void
}

export function MonthCalendarGrid({
  viewMonth,
  selected,
  onSelectDay,
  onShiftMonth,
}: MonthCalendarGridProps) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("common-datetime")
  const { locale } = useLocale()
  const weekStart = weekStartForLocale(locale)
  const sundayFirstInitials = t("calendar.weekday_initials", {
    returnObjects: true,
    defaultValue: ["S", "M", "T", "W", "T", "F", "S"],
  }) as string[]
  const weekdayInitials = rotateWeekdays(sundayFirstInitials, weekStart)

  const today = startOfDay(new Date())
  const grid = useMemo(
    () => monthGrid(viewMonth.year, viewMonth.month, weekStart),
    [viewMonth, weekStart],
  )

  const monthLabel = new Date(viewMonth.year, viewMonth.month, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  })

  return (
    <View>
      <View style={styles.monthRow}>
        <Pressable
          onPress={() => onShiftMonth(-1)}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.previous_month")}
          hitSlop={8}
          {...focusRingProps}
          style={(state) => [
            styles.monthNav,
            webCursorPointer,
            webTransition,
            webHover(state) ? styles.monthNavHovered : null,
            state.pressed ? styles.pressed : null,
          ]}
        >
          <Icon icon={iconMap.ChevronLeft} size={20} color={th.colors.text} />
        </Pressable>
        <Text variant="bodyStrong">{monthLabel}</Text>
        <Pressable
          onPress={() => onShiftMonth(1)}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.next_month")}
          hitSlop={8}
          {...focusRingProps}
          style={(state) => [
            styles.monthNav,
            webCursorPointer,
            webTransition,
            webHover(state) ? styles.monthNavHovered : null,
            state.pressed ? styles.pressed : null,
          ]}
        >
          <Icon icon={iconMap.ChevronRight} size={20} color={th.colors.text} />
        </Pressable>
      </View>

      <View style={styles.weekHeader}>
        {weekdayInitials.map((w, i) => (
          <View key={i} style={styles.weekCell}>
            <Text variant="caption" color={th.colors.textSubtle}>
              {w}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {grid.map((day, i) => {
          if (day === null) return <View key={`pad-${i}`} style={styles.dayCell} />
          const cellDate = new Date(viewMonth.year, viewMonth.month, day)
          const disabled = startOfDay(cellDate) < today
          const isSelected = selected ? sameDay(cellDate, selected) : false
          return (
            <View key={`day-${day}`} style={styles.dayCell}>
              <Pressable
                onPress={() => onSelectDay(day)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected, disabled }}
                {...focusRingProps}
                style={(state) => [
                  styles.dayBtn,
                  webCursor(disabled),
                  webTransition,
                  isSelected ? styles.daySelected : null,
                  webHover(state) && !disabled
                    ? isSelected
                      ? styles.daySelectedHovered
                      : styles.dayPressed
                    : null,
                  state.pressed && !isSelected ? styles.dayPressed : null,
                ]}
              >
                <Text
                  variant="body"
                  color={
                    isSelected
                      ? th.colors.onAccent
                      : disabled
                        ? th.colors.textSubtle
                        : th.colors.text
                  }
                >
                  {day}
                </Text>
              </Pressable>
            </View>
          )
        })}
      </View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: t.space["3"],
  },
  monthNav: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.bgAlt,
  },
  monthNavHovered: {
    backgroundColor: t.colors.surfaceTint,
  },
  weekHeader: {
    flexDirection: "row",
    marginBottom: t.space["1"],
  },
  weekCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: t.space["1"],
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    maxHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
  },
  dayBtn: {
    width: "100%",
    height: "100%",
    maxWidth: 44,
    maxHeight: 44,
    borderRadius: t.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  daySelected: {
    backgroundColor: t.colors.brand.bloom,
  },
  daySelectedHovered: {
    backgroundColor: t.colors.bloom["700"],
  },
  dayPressed: {
    backgroundColor: t.colors.bgAlt,
  },
  pressed: {
    opacity: 0.85,
  },
}))
