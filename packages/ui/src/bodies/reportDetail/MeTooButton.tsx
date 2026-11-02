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
  type Theme,
} from "../../theme"
import { Icon, Text, iconMap } from "../../typography"

const ME_TOO_HEIGHT_SM = 36
const ME_TOO_SM_HIT_SLOP = hitSlopToTarget(ME_TOO_HEIGHT_SM)
// RN's small spinner is 20 pt on every platform; scaled into the glyph's box, busy never widens the pill.
const SPINNER_SMALL = 20

export type MeTooTone = "seen" | "fixed"

// Each vote wears the colour of what it says: coral (the brand's "report a problem" colour) for a problem still
// there, moss (the Resolved badge's colour) for fixed.
function toneColors(tone: MeTooTone, th: Theme) {
  const c = th.colors
  return tone === "fixed"
    ? {
        solid: c.brand.moss,
        wash: c.moss["50"],
        washHover: c.moss["100"],
        edge: c.moss["300"],
        ink: c.chipInk.moss,
      }
    : {
        solid: c.brand.bloom,
        wash: c.bloom["50"],
        washHover: c.bloom["100"],
        edge: c.bloom["300"],
        ink: c.chipInk.bloom,
      }
}

/**
 * A vote ("I see it too", "Looks fixed") as a pill outlined in its tone that fills with the tone's wash and a
 * check once pressed. Small (the Possible duplicate screen) is always the tone's wash, so it reads as the same
 * vote inside its card.
 */
export function MeTooButton({
  label,
  accessibilityLabel,
  pressed,
  busy = false,
  disabled = false,
  size = "md",
  tone = "seen",
  onPress,
}: {
  label: string
  accessibilityLabel: string
  pressed: boolean
  busy?: boolean
  disabled?: boolean
  size?: "sm" | "md"
  tone?: MeTooTone
  onPress: () => void
}) {
  const styles = useStyles()
  const th = useTheme()
  const tc = toneColors(tone, th)
  const inert = busy || disabled
  const sm = size === "sm"
  const washed = sm || pressed
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
        washed
          ? { backgroundColor: tc.wash, borderColor: sm ? tc.edge : tc.solid }
          : { backgroundColor: th.colors.surface, borderColor: tc.edge },
        webHover(state) && !inert ? { backgroundColor: washed ? tc.washHover : tc.wash } : null,
        state.pressed ? styles.down : null,
      ]}
    >
      {/* The label stays while busy so the button keeps its size; the spinner takes the glyph's place. */}
      {busy ? (
        <View
          style={{ width: glyph, height: glyph, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator
            size="small"
            color={tc.ink}
            style={{ transform: [{ scale: glyph / SPINNER_SMALL }] }}
          />
        </View>
      ) : (
        <Icon
          icon={pressed ? iconMap.Check : tone === "fixed" ? iconMap.CheckCircle2 : iconMap.Users}
          size={glyph}
          color={tc.ink}
        />
      )}
      <Text
        variant={sm ? "label" : "bodyStrong"}
        color={sm ? tc.ink : th.colors.text}
        style={[styles.label, webNoSelect]}
      >
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
  },
  // Two md buttons share a row on the report page, so a long translation wraps instead of overflowing the pill,
  // and each grows to fill its half so a one-line label's pill matches the height of a wrapped one beside it.
  md: {
    flexGrow: 1,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: t.space["5"],
    paddingVertical: t.space["2"],
  },
  sm: { height: ME_TOO_HEIGHT_SM, paddingHorizontal: t.space["3"] },
  label: { flexShrink: 1, textAlign: "center" },
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
