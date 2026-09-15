import React from "react"
import { View } from "react-native"
import type { EventSlotDTO } from "@civfix/shared"
import { timeRangeLabel } from "@civfix/shared/datetime"
import { makeThemedStyles } from "../../theme"
import { Text } from "../../typography"
import { Meter } from "../../primitives/Meter"
import { useLocale, useT } from "../../i18n"

export interface ShiftRowProps {
  slot: EventSlotDTO
  current?: boolean
  timeZone?: string
}

export function ShiftRow({ slot, current = false, timeZone }: ShiftRowProps) {
  const styles = useStyles()
  const { t } = useT("host-mode")
  const { locale } = useLocale()
  const range =
    slot.startsAt == null || slot.endsAt == null
      ? ""
      : timeRangeLabel(slot.startsAt, slot.endsAt, locale, timeZone)
  const headline = [slot.title, range].filter((part) => part.length > 0).join(" · ")
  const count =
    slot.capacity == null
      ? t("shifts.signed_up", { count: slot.claimed })
      : t("shifts.of", { claimed: slot.claimed, capacity: slot.capacity })
  return (
    <View style={styles.root}>
      <View style={styles.line}>
        <Text
          variant="label"
          style={[styles.title, current ? styles.titleCurrent : null]}
          numberOfLines={1}
        >
          {headline}
        </Text>
        <Text style={styles.value} numberOfLines={1}>
          {count}
        </Text>
      </View>
      {slot.capacity == null ? null : (
        <Meter
          value={slot.claimed}
          max={slot.capacity}
          accessibilityLabel={t("shifts.row_a11y", {
            title: slot.title,
            range,
            claimed: slot.claimed,
            capacity: slot.capacity,
          })}
        />
      )}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: {
    gap: t.space["1"],
  },
  line: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["2"],
  },
  title: {
    flex: 1,
    minWidth: 0,
    lineHeight: 18,
  },
  titleCurrent: {
    color: t.colors.text,
  },
  value: {
    flexShrink: 0,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    lineHeight: 18,
    color: t.colors.text,
  },
}))
