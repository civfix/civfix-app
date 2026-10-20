import React from "react"
import { ActivityIndicator, Pressable, View } from "react-native"
import {
  MIN_TOUCH_TARGET,
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

const ME_TOO_HEIGHT_SM = 36
const ME_TOO_SM_HIT_SLOP = hitSlopToTarget(ME_TOO_HEIGHT_SM)
// RN's small spinner is 20 pt on every platform; scaled into the glyph's box, busy never widens the pill.
const SPINNER_SMALL = 20

/**
 * A vote ("I see this too", "This is fixed") as a full-width outline button (SecondaryButton's look) that
 * fills with moss once pressed, so the pressed state reads as done rather than as a second call to action.
 */
export function MeTooButton({
  label,
  accessibilityLabel,
  pressed,
  busy = false,
  disabled = false,
  size = "md",
  onPress,
}: {
  label: string
  accessibilityLabel: string
  pressed: boolean
  busy?: boolean
  disabled?: boolean
  size?: "sm" | "md"
  onPress: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const fg = pressed ? th.colors.moss["700"] : th.colors.text
  const inert = busy || disabled
  const sm = size === "sm"
  const glyph = sm ? 16 : 18
  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: pressed, busy, disabled }}
      // react-native-web maps no accessibilityState to ARIA, and RN's props have no aria-pressed.
      {...({ "aria-pressed": pressed } as object)}
      aria-busy={busy}
      hitSlop={sm ? ME_TOO_SM_HIT_SLOP : undefined}
      {...focusRingProps}
      style={(state) => [
        styles.base,
        sm ? styles.sm : styles.md,
        webTransition,
        webCursor(inert),
        pressed ? styles.pressedOn : null,
        webHover(state) && !inert ? (pressed ? styles.pressedHovered : styles.hovered) : null,
        state.pressed ? styles.down : null,
      ]}
    >
      {/* The label stays while busy so the button keeps its size; the spinner takes the glyph's place. */}
      {busy ? (
        <View style={{ width: glyph, height: glyph, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="small" color={fg} style={{ transform: [{ scale: glyph / SPINNER_SMALL }] }} />
        </View>
      ) : (
        <Icon icon={pressed ? iconMap.Check : iconMap.Plus} size={glyph} color={fg} />
      )}
      <Text variant={sm ? "label" : "bodyStrong"} color={fg} style={[styles.label, webNoSelect]}>
        {label}
      </Text>
    </Pressable>
  )
}

/** The counts line under the report page's vote buttons (reportCountsLine). */
export function MeTooCount({ text, centered = false }: { text: string; centered?: boolean }) {
  const styles = useStyles()
  const th = useTheme()
  return (
    <View style={[styles.countRow, centered ? styles.countCentered : null]}>
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
    alignSelf: "stretch",
    gap: t.space["2"],
    borderRadius: t.radius.pill,
    borderWidth: 1.5,
    borderColor: t.colors.borderStrong,
    backgroundColor: t.colors.surface,
  },
  // Two md buttons share a row on the report page, so a long translation wraps instead of overflowing the pill,
  // and each grows to fill its half so a one-line label's pill matches the height of a wrapped one beside it.
  md: { flexGrow: 1, minHeight: MIN_TOUCH_TARGET, paddingHorizontal: t.space["5"], paddingVertical: t.space["2"] },
  sm: { height: ME_TOO_HEIGHT_SM, paddingHorizontal: t.space["3"] },
  label: { flexShrink: 1, textAlign: "center" },
  hovered: { backgroundColor: t.colors.surfaceTint },
  pressedOn: { backgroundColor: t.colors.moss["50"], borderColor: t.colors.moss["300"] },
  pressedHovered: { backgroundColor: t.colors.moss["100"] },
  down: { opacity: 0.85 },
  countRow: { flexDirection: "row", alignItems: "flex-start", gap: t.space["1"] },
  countCentered: { justifyContent: "center" },
  count: {
    flexShrink: 1,
    fontFamily: t.fontFamily.bodySemiBold,
    fontSize: t.fontSize["13"],
    color: t.colors.textMuted,
  },
}))
