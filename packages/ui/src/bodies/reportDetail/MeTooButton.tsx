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

/** Me too as a pill in FollowButton's two states: a filled call to action, then a quiet "done" tint. */
export function MeTooButton({
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
  const fg = pressed ? th.colors.moss["700"] : th.colors.onAccent
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
        styles.base,
        webTransition,
        webCursor(inert),
        pressed ? styles.pressedOn : styles.idle,
        webHover(state) && !inert ? styles.hovered : null,
        state.pressed ? styles.down : null,
      ]}
    >
      {/* The label stays while busy so the pill keeps its width; the spinner takes the glyph's place. */}
      {busy ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <Icon icon={pressed ? iconMap.Check : iconMap.Plus} size={14} color={fg} />
      )}
      <Text color={fg} style={[styles.label, webNoSelect]}>
        {label}
      </Text>
    </Pressable>
  )
}

/** "N neighbors saw this too", the count every surface shows above 0. */
export function MeTooCount({ text }: { text: string }) {
  const styles = useStyles()
  const th = useTheme()
  return (
    <View style={styles.countRow}>
      <Icon icon={iconMap.Users} size={14} color={th.colors.textMuted} />
      <Text style={styles.count}>{text}</Text>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: t.space["1"],
    height: ME_TOO_HEIGHT,
    paddingHorizontal: t.space["3"],
    borderRadius: t.radius.pill,
  },
  idle: { backgroundColor: t.colors.brand.bloom },
  pressedOn: { backgroundColor: t.colors.moss["50"] },
  hovered: { opacity: 0.92 },
  down: { opacity: 0.9, transform: [{ scale: 0.96 }] },
  label: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: t.fontSize["13"],
  },
  countRow: { flexDirection: "row", alignItems: "flex-start", gap: t.space["1"] },
  count: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
}))
