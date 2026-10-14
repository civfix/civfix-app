import React from "react"
import { View, Pressable, ActivityIndicator } from "react-native"
import { focusRingProps, makeThemedStyles, useTheme } from "../theme"
import { Text, Icon, iconMap } from "../typography"

const ROW_MIN_HEIGHT = { flush: 52, inset: 56 } as const
const TRAILING_SLOT = 24
const CHECK_GLYPH = 18

/**
 * `flush` sits in a bare list and keeps the text column hard against the trailing slot; `inset` sits in a
 * SettingsSection card, pads to the card's gutter and spaces a leading logo off the text.
 */
export type RadioOptionRowLayout = "flush" | "inset"

export interface RadioOptionRowProps {
  label: string
  sub?: string
  selected: boolean
  pending: boolean
  onPress: () => void
  layout: RadioOptionRowLayout
  leading?: React.ReactNode
}

export const RadioOptionRow = React.memo(function RadioOptionRow({
  label,
  sub,
  selected,
  pending,
  onPress,
  layout,
  leading,
}: RadioOptionRowProps) {
  const styles = useStyles()
  const th = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, busy: pending }}
      aria-checked={selected}
      aria-busy={pending}
      accessibilityLabel={label}
      {...focusRingProps}
      style={({ pressed }) => [
        layout === "flush" ? styles.rowFlush : styles.rowInset,
        pressed ? styles.rowPressed : null,
      ]}
    >
      {leading}
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, selected ? styles.rowLabelSelected : null]} numberOfLines={1}>
          {label}
        </Text>
        {sub ? (
          <Text style={styles.rowSub} numberOfLines={2}>
            {sub}
          </Text>
        ) : null}
      </View>
      <View style={styles.trailing}>
        {pending ? (
          <ActivityIndicator size="small" color={th.colors.brand.bloom} />
        ) : selected ? (
          <Icon icon={iconMap.Check} size={CHECK_GLYPH} color={th.colors.brand.bloom} />
        ) : null}
      </View>
    </Pressable>
  )
})

const useStyles = makeThemedStyles((t) => ({
  rowFlush: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: ROW_MIN_HEIGHT.flush,
    paddingVertical: 14,
    paddingHorizontal: t.space["1"],
  },
  rowInset: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
    minHeight: ROW_MIN_HEIGHT.inset,
    paddingHorizontal: t.space["3"],
    paddingVertical: t.space["3"],
  },
  rowPressed: {
    opacity: 0.7,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["15"],
    color: t.colors.text,
  },
  rowLabelSelected: {
    fontFamily: t.fontFamily.bodyBold,
  },
  rowSub: {
    fontFamily: t.fontFamily.bodyRegular,
    fontSize: t.fontSize["13"],
    color: t.colors.textSubtle,
    marginTop: 2,
  },
  trailing: {
    width: TRAILING_SLOT,
    height: TRAILING_SLOT,
    alignItems: "flex-end",
    justifyContent: "center",
  },
}))
