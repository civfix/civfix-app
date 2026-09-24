import React from "react"
import { View, StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from "react-native"
import { isValidTimeZone, wallClockInZone } from "@civfix/shared/datetime"
import { makeThemedStyles, radius, useTheme } from "../theme"
import { Text } from "../typography"
import { useLocale } from "../i18n"

const DEFAULT_BADGE_SIZE = 56
const COMPACT_BADGE_MAX = 48
const TINT_ALPHA_HEX = "1A"

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

interface TileLine {
  text: string
  style: StyleProp<TextStyle>
  color?: string
}

function Tile({ frame, top, bottom }: { frame: StyleProp<ViewStyle>; top: TileLine; bottom: TileLine }) {
  return (
    <View style={frame}>
      <Text color={top.color} style={top.style}>
        {top.text}
      </Text>
      <Text color={bottom.color} style={bottom.style}>
        {bottom.text}
      </Text>
    </View>
  )
}

export function DateBadge({
  iso,
  size = DEFAULT_BADGE_SIZE,
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
  const compact = size <= COMPACT_BADGE_MAX
  return (
    <Tile
      frame={[
        styles.badge,
        { width: size, height: size, borderRadius: compact ? radius.sm : radius.md },
      ]}
      top={{
        text: weekday,
        color: t.colors.sun["700"],
        style: compact ? styles.badgeWeekdayCompact : styles.badgeWeekday,
      }}
      bottom={{ text: day, style: compact ? styles.badgeDayCompact : styles.badgeDay }}
    />
  )
}

/**
 * Each surface's day-and-month tile keeps its own geometry as a named preset here, so unifying two of
 * them is a one-file change. `profileEvent` is the only tinted one: it paints in the caller's `color`.
 */
export type DateTileVariant =
  | "personEvent"
  | "ledger"
  | "profileEvent"
  | "searchHit"
  | "eventCard"
  | "linkedEvent"

export interface DateTileProps {
  day: string
  month: string
  variant: DateTileVariant
  color?: string
}

export function DateTile({ day, month, variant, color }: DateTileProps) {
  const styles = useStyles()
  const t = useTheme()
  switch (variant) {
    case "personEvent":
      return (
        <Tile
          frame={styles.personEvent}
          top={{ text: day, style: styles.sunChipDay }}
          bottom={{ text: month, style: styles.personEventMonth }}
        />
      )
    case "ledger":
      return (
        <Tile
          frame={styles.ledger}
          top={{ text: day, style: styles.sunChipDay }}
          bottom={{ text: month, style: styles.sunChipMonth }}
        />
      )
    case "profileEvent":
      return (
        <Tile
          frame={[styles.profileEvent, { backgroundColor: `${color}${TINT_ALPHA_HEX}` }]}
          top={{ text: day, color, style: styles.profileEventDay }}
          bottom={{ text: month, color, style: styles.profileEventMonth }}
        />
      )
    case "searchHit":
      return (
        <Tile
          frame={styles.searchHit}
          top={{ text: month, style: styles.searchHitMonth }}
          bottom={{ text: day, style: styles.searchHitDay }}
        />
      )
    case "eventCard":
      return (
        <Tile
          frame={styles.eventCard}
          top={{ text: day, style: styles.eventCardDay }}
          bottom={{ text: month, color: t.colors.bloom["600"], style: styles.eventCardMonth }}
        />
      )
    case "linkedEvent":
      return (
        <Tile
          frame={styles.linkedEvent}
          top={{ text: month, style: styles.linkedEventMonth }}
          bottom={{ text: day, style: styles.linkedEventDay }}
        />
      )
  }
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

  personEvent: {
    flexShrink: 0,
    width: 34,
    paddingVertical: t.space["1"],
    borderRadius: 9,
    backgroundColor: t.colors.sun["50"],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.sun["100"],
    alignItems: "center",
  },
  ledger: {
    width: 38,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: t.space["1"],
    borderRadius: 9,
    backgroundColor: t.colors.sun["50"],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.sun["100"],
  },
  sunChipDay: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: t.fontSize["15"],
    lineHeight: 16,
    color: t.colors.sun["700"],
  },
  sunChipMonth: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 8,
    letterSpacing: 0.5,
    color: t.colors.sun["700"],
  },
  personEventMonth: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 8,
    letterSpacing: 0.5,
    color: t.colors.sun["700"],
    marginTop: 2,
  },

  profileEvent: {
    width: 46,
    height: 46,
    flexShrink: 0,
    borderRadius: t.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  profileEventDay: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: 19,
    lineHeight: 20,
  },
  profileEventMonth: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 9,
    letterSpacing: 0.5,
    marginTop: 2,
  },

  searchHit: {
    width: 46,
    height: 46,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.md,
    backgroundColor: t.colors.sun["50"],
  },
  searchHitMonth: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 0.7,
    color: t.colors.sun["700"],
  },
  searchHitDay: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: 19,
    lineHeight: 21,
    color: t.colors.text,
  },

  eventCard: {
    width: 50,
    flexShrink: 0,
    alignSelf: "flex-start",
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: t.colors.bgAlt,
    alignItems: "center",
  },
  eventCardDay: {
    fontFamily: t.fontFamily.displayBold,
    fontSize: 23,
    lineHeight: 23,
    color: t.colors.text,
  },
  eventCardMonth: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 11,
    letterSpacing: 0.55,
    marginTop: 3,
  },

  linkedEvent: {
    width: 52,
    minHeight: 58,
    flexShrink: 0,
    borderRadius: t.radius.md,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.surfaceTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
  },
  linkedEventMonth: {
    color: t.colors.sun["700"],
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.8,
  },
  linkedEventDay: {
    color: t.colors.text,
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 21,
    lineHeight: 24,
  },
}))
