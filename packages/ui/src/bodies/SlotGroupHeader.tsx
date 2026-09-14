import React from "react"
import { View } from "react-native"
import { timeRangeLabel } from "@civfix/shared/datetime"
import { headingLevel, makeThemedStyles } from "../theme"
import { Text } from "../typography"
import { useLocale, useT } from "../i18n"

export interface SlotGroupHeaderProps {
  title: string
  claimed: number | null
  capacity: number | null
  startsAt: string | null
  endsAt: string | null
  timeZone: string | undefined
}

export function SlotGroupHeader({
  title,
  claimed,
  capacity,
  startsAt,
  endsAt,
  timeZone,
}: SlotGroupHeaderProps) {
  const styles = useStyles()
  const { t } = useT("event-slots")
  const { locale } = useLocale()
  const range = startsAt && endsAt ? timeRangeLabel(startsAt, endsAt, locale, timeZone) : null
  return (
    <View
      style={styles.slotHeaderBlock}
      accessibilityRole="header"
      {...headingLevel(2)}
      {...(range ? { accessibilityLabel: t("roster.window_a11y", { title, range }) } : {})}
    >
      <View style={styles.slotHeader}>
        <Text style={styles.slotHeaderTitle} numberOfLines={1}>
          {title}
        </Text>
        {claimed == null ? null : (
          <View style={styles.slotHeaderCount}>
            <Text style={styles.slotHeaderCountText}>
              {capacity == null ? String(claimed) : `${claimed}/${capacity}`}
            </Text>
          </View>
        )}
      </View>
      {range ? (
        <Text style={styles.slotHeaderRange} numberOfLines={1}>
          {range}
        </Text>
      ) : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  slotHeaderBlock: {
    paddingTop: t.space["4"],
    paddingBottom: t.space["2"],
  },
  slotHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  slotHeaderRange: {
    marginTop: t.space["1"],
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["12"],
    color: t.colors.textSubtle,
  },
  slotHeaderTitle: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: t.colors.textSubtle,
  },
  slotHeaderCount: {
    flexShrink: 0,
    paddingHorizontal: t.space["2"],
    paddingVertical: 1,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.bgAlt,
  },
  slotHeaderCountText: {
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: 11,
    color: t.colors.textSubtle,
  },
}))
