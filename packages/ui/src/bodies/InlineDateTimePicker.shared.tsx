import React from "react"
import { View } from "react-native"
import { makeThemedStyles } from "../theme"
import { Text } from "../typography"
import { FilterChip } from "../primitives"
import { useT, useLocale } from "../i18n"
import {
  DURATION_CHIP_HOURS,
  durationChipFor,
  endsNextDay,
  endTimeAfterInZone,
  nowClockInZone,
  sameDay,
  todayInZone,
  type DurationChipHours,
} from "./calendarModel"
import {
  TIME_PICKER_MINUTE_INTERVAL,
  type DateFieldRowProps,
  type InlineDateTimePickerProps,
  type TimeFieldRowProps,
} from "./InlineDateTimePicker.types"

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
  const activeDuration = durationChipFor(date, time, endTime, timeZone)

  const selectDuration = (hours: DurationChipHours) => {
    if (!date || !time || !onEndTimeChange) return
    onEndTimeChange(endTimeAfterInZone(date, time, hours * 3_600_000, timeZone))
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
        minuteInterval={TIME_PICKER_MINUTE_INTERVAL}
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
            minuteInterval={TIME_PICKER_MINUTE_INTERVAL}
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
}))
