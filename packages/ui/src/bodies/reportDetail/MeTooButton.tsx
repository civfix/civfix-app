import React from "react"
import { ActivityIndicator, Pressable, View } from "react-native"
import {
  focusRingProps,
  hitSlopToTarget,
  makeThemedStyles,
  useTheme,
  webCursor,
  webHover,
  webNoSelect,
  webTransition,
} from "../../theme"
import { Icon, Text, iconMap } from "../../typography"

const ME_TOO_HEIGHT = 32
const ME_TOO_HIT_SLOP = hitSlopToTarget(ME_TOO_HEIGHT)

/** Me too as a soft chip, the way a reaction sits under a post: quiet until pressed, then tinted moss. */
export function MeTooChip({
  label,
  accessibilityLabel,
  pressed,
  busy = false,
  disabled = false,
  onPress,
}: {
  label: string
  accessibilityLabel: string
  pressed: boolean
  busy?: boolean
  disabled?: boolean
  onPress: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const fg = pressed ? th.colors.moss["700"] : th.colors.text
  const inert = busy || disabled
  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: pressed, busy, disabled }}
      hitSlop={ME_TOO_HIT_SLOP}
      {...focusRingProps}
      style={(state) => [
        styles.chip,
        webTransition,
        webCursor(inert),
        pressed ? styles.chipOn : null,
        webHover(state) && !inert ? (pressed ? styles.chipOnHovered : styles.chipHovered) : null,
        state.pressed ? styles.down : null,
      ]}
    >
      {/* The label stays while busy so the chip keeps its width; the spinner takes the glyph's place. */}
      {busy ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <Icon icon={pressed ? iconMap.Check : iconMap.Plus} size={15} color={fg} />
      )}
      <Text color={fg} style={[styles.label, webNoSelect]}>
        {label}
      </Text>
    </Pressable>
  )
}

/** The chip and the count on one line; either may be absent (no button for the reporter, no count at 0). */
export function MeTooRow({ chip, count }: { chip: React.ReactNode; count: string | null }) {
  const styles = useStyles()
  const th = useTheme()
  return (
    <View style={styles.row}>
      {chip}
      {count ? (
        <View style={styles.countRow}>
          {chip ? null : <Icon icon={iconMap.Users} size={14} color={th.colors.textMuted} />}
          <Text style={styles.count}>{count}</Text>
        </View>
      ) : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: t.space["1"],
    height: ME_TOO_HEIGHT,
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.bgAlt,
  },
  chipHovered: { backgroundColor: t.colors.surfaceTint },
  chipOn: { backgroundColor: t.colors.moss["100"] },
  chipOnHovered: { backgroundColor: t.colors.moss["50"] },
  down: { opacity: 0.85 },
  label: { fontFamily: t.fontFamily.bodyBold, fontSize: t.fontSize["13"] },
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: t.space["3"] },
  countRow: { flexDirection: "row", alignItems: "center", flexShrink: 1, gap: t.space["1"] },
  count: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
}))
