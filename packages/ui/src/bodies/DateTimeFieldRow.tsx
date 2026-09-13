import React from "react"
import { View, Pressable } from "react-native"
import {
  makeThemedStyles,
  useTheme,
  focusRingProps,
  webCursorPointer,
  webTransition,
  webHover,
} from "../theme"
import { Text, Icon, iconMap, type LucideIcon } from "../typography"
import { FilterChip } from "../primitives"
import { useT, useLocale } from "../i18n"
import {
  DURATION_CHIP_HOURS,
  durationChipFor,
  endsNextDay,
  endTimeAfter,
  nowClockInZone,
  sameDay,
  todayInZone,
  type DurationChipHours,
} from "./calendarModel"
import type {
  DateFieldRowProps,
  InlineDateTimePickerProps,
  TimeFieldRowProps,
} from "./InlineDateTimePicker.types"

const ROW_HEIGHT = 52

export interface DateTimeFieldRowProps {
  icon: LucideIcon
  value: string
  accessibilityLabel: string
  label?: string | undefined
  placeholder?: boolean
  valueSlot?: React.ReactNode
  trailing?: React.ReactNode
  suffix?: string | null
  error?: string | null
  spaced?: boolean
  onPress?: (() => void) | undefined
}

export function DateTimeFieldRow({
  icon,
  value,
  accessibilityLabel,
  label,
  placeholder = false,
  valueSlot,
  trailing,
  suffix,
  error,
  spaced = false,
  onPress,
}: DateTimeFieldRowProps) {
  const styles = useStyles()
  const th = useTheme()

  const body = (
    <>
      <Icon icon={icon} size={16} color={th.colors.textSubtle} />
      {label ? (
        <Text numberOfLines={1} style={styles.fieldLabel}>
          {label}
        </Text>
      ) : null}
      {valueSlot ?? (
        <Text
          numberOfLines={1}
          style={[styles.fieldValue, placeholder ? styles.fieldPlaceholder : null]}
        >
          {value}
        </Text>
      )}
      {suffix ? (
        <Text numberOfLines={1} style={styles.fieldSuffix}>
          {suffix}
        </Text>
      ) : null}
      {trailing}
    </>
  )

  return (
    <View style={spaced ? styles.blockSpaced : null}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityValue={{ text: value }}
          {...focusRingProps}
          style={(state) => [
            styles.fieldRow,
            webCursorPointer,
            webTransition,
            webHover(state) ? styles.fieldRowHovered : null,
            state.pressed ? styles.pressed : null,
          ]}
        >
          {body}
        </Pressable>
      ) : (
        <View style={styles.fieldRow}>{body}</View>
      )}
      {error ? (
        <View style={styles.errorRow}>
          <Icon icon={iconMap.AlertCircle} size={13} color={th.colors.accentText} />
          <Text numberOfLines={2} style={styles.errorText}>
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

export interface InlineDateTimePickerLayoutProps extends InlineDateTimePickerProps {
  DateRow: React.ComponentType<DateFieldRowProps>
  TimeRow: React.ComponentType<TimeFieldRowProps>
}

export function InlineDateTimePickerLayout({
  date,
  time,
  endTime = null,
  timeZone,
  minDate,
  onDateChange,
  onTimeChange,
  onEndTimeChange,
  errors,
  DateRow,
  TimeRow,
}: InlineDateTimePickerLayoutProps) {
  const styles = useStyles()
  const { t } = useT("common-datetime")
  const { t: tForm } = useT("event-form")
  const { locale } = useLocale()

  const dateValue = date
    ? date.toLocaleDateString(locale, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null
  const timeValue = time
    ? time.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })
    : null
  const endClock = endTime
    ? endTime.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })
    : null

  const rollsOver = time != null && endTime != null && endsNextDay(time, endTime)
  const dateText = dateValue ?? t("placeholder.pick_date")
  const timeText = timeValue ?? t("placeholder.pick_time")
  const endText =
    endClock === null
      ? t("placeholder.pick_end_time")
      : rollsOver
        ? t("value.end_next_day", { time: endClock })
        : endClock

  const earliestDate = minDate ?? todayInZone(timeZone)
  const startFloor =
    date !== null && sameDay(date, todayInZone(timeZone)) ? nowClockInZone(timeZone) : null
  const activeDuration = durationChipFor(date, time, endTime)

  const selectDuration = (hours: DurationChipHours) => {
    if (!date || !time || !onEndTimeChange) return
    onEndTimeChange(endTimeAfter(date, time, hours * 3_600_000))
  }

  return (
    <View>
      <DateRow
        value={date}
        displayValue={dateText}
        placeholder={dateValue === null}
        accessibilityLabel={t("a11y.date_field", { value: dateText })}
        onChange={onDateChange}
        minDate={earliestDate}
        error={errors?.date ?? null}
      />

      <TimeRow
        value={time}
        displayValue={timeText}
        placeholder={timeValue === null}
        accessibilityLabel={t("a11y.time_field", { value: timeText })}
        onChange={onTimeChange}
        label={tForm("field.startTime")}
        day={date}
        minTime={startFloor}
        minuteInterval={5}
        error={errors?.time ?? null}
        spaced
      />

      {onEndTimeChange ? (
        <>
          <View style={styles.durationRow}>
            <Text style={styles.durationLabel}>{tForm("field.runsFor")}</Text>
            {DURATION_CHIP_HOURS.map((hours) => (
              <FilterChip
                key={hours}
                label={tForm("field.duration_hours", { count: hours })}
                selected={activeDuration === hours}
                disabled={date === null || time === null}
                onPress={() => selectDuration(hours)}
              />
            ))}
          </View>

          <TimeRow
            value={endTime}
            displayValue={endText}
            placeholder={endClock === null}
            accessibilityLabel={t("a11y.end_time_field", { value: endText })}
            onChange={onEndTimeChange}
            label={tForm("field.endTime")}
            day={date}
            minuteInterval={5}
            suffix={rollsOver ? t("value.next_day") : null}
            error={errors?.endTime ?? null}
            spaced
          />
        </>
      ) : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  blockSpaced: {
    marginTop: t.space["2"],
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.border,
    minHeight: ROW_HEIGHT,
    paddingHorizontal: t.space["4"],
  },
  fieldRowHovered: {
    backgroundColor: t.colors.surfaceTint,
    borderColor: t.colors.borderStrong,
  },
  fieldLabel: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
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
  fieldSuffix: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  durationRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: t.space["2"],
    marginTop: t.space["2"],
  },
  durationLabel: {
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: t.space["1"],
    paddingHorizontal: t.space["1"],
  },
  errorText: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.accentText,
  },
  pressed: {
    opacity: 0.85,
  },
}))
