import React from "react"
import { View, StyleSheet } from "react-native"
import { isValidTimeZone, wallClockInZone } from "@civfix/shared/datetime"
import { makeThemedStyles, radius, useTheme } from "../theme"
import { Text } from "../typography"
import { useLocale } from "../i18n"

function dateParts(
  iso: string,
  locale: string,
  timeZone: string | undefined,
): { weekday: string; day: string } {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { weekday: "--", day: "--" }
  const zone = timeZone !== undefined && isValidTimeZone(timeZone) ? timeZone : undefined
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: zone }).format(d)
  const day = zone === undefined ? d.getDate() : wallClockInZone(d.getTime(), zone).day
  return { weekday: weekday.toUpperCase(), day: String(day) }
}

export function DateBadge({
  iso,
  size = 56,
  timeZone,
}: {
  iso: string
  size?: number
  timeZone?: string
}) {
  const styles = useStyles()
  const t = useTheme()
  const { locale } = useLocale()
  const { weekday, day } = dateParts(iso, locale, timeZone)
  const compact = size <= 48
  return (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: compact ? radius.sm : radius.md },
      ]}
    >
      <Text
        color={t.colors.sun["700"]}
        style={compact ? styles.badgeWeekdayCompact : styles.badgeWeekday}
      >
        {weekday}
      </Text>
      <Text style={compact ? styles.badgeDayCompact : styles.badgeDay}>{day}</Text>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  badge: {
    backgroundColor: t.colors.sun["50"],
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.sun["100"],
  },
  badgeWeekday: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 0.8,
    lineHeight: 12,
  },
  badgeDay: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: t.fontSize["24"],
    color: t.colors.text,
    lineHeight: 28,
  },
  badgeWeekdayCompact: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 9,
    letterSpacing: 0.6,
    lineHeight: 11,
  },
  badgeDayCompact: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: t.fontSize["18"],
    color: t.colors.text,
    lineHeight: 22,
  },
}))
