import React, { useCallback } from "react"
import {
  Pressable,
  ActivityIndicator,
  View,
  Animated,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import {
  makeThemedStyles,
  useTheme,
  webCursor,
  webTransition,
  webHover,
  webNoSelect,
  focusRingProps,
  useLayoutMode,
} from "../theme"
import { Text, Icon, iconMap } from "../typography"
import { useAuthState, useRequireAuth } from "../data"
import { useT } from "../i18n"
import { buildRsvpPillLayoutPlan } from "./rsvpPillModel"
import { POP_ENABLED, usePopScale } from "./usePopScale"
export { buildRsvpPillLayoutPlan } from "./rsvpPillModel"

export interface RsvpPillProps {
  going: boolean
  onToggle: (currentlyGoing: boolean) => void
  nextPath: string
  size?: "sm" | "md"
  busy?: boolean
  style?: StyleProp<ViewStyle>
  fill?: boolean
  onSignedOutPress?: () => void
}

export function RsvpPill({
  going,
  onToggle,
  nextPath,
  size = "md",
  busy = false,
  style,
  fill = false,
  onSignedOutPress,
}: RsvpPillProps) {
  const styles = useStyles()
  const th = useTheme()
  const requireAuth = useRequireAuth()
  const { isAuthenticated, isPending } = useAuthState()
  const { t } = useT("event-rsvp")
  const compact = size === "sm"
  const layout = buildRsvpPillLayoutPlan(size)
  const stretchToCell = useLayoutMode() === "expanded"
  const fillCell = stretchToCell && fill

  const onPress = useCallback(() => {
    if (onSignedOutPress && !isAuthenticated && !isPending) {
      onSignedOutPress()
      return
    }
    requireAuth(() => onToggle(going), { next: nextPath })
  }, [onSignedOutPress, isAuthenticated, isPending, requireAuth, onToggle, going, nextPath])

  const popScale = usePopScale(going)

  const fg = going ? th.colors.moss["700"] : th.colors.onAccent

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ selected: going, busy }}
      accessibilityLabel={going ? t("a11y.going") : t("a11y.rsvp")}
      {...focusRingProps}
      style={[styles.target, stretchToCell ? styles.targetStretch : null, layout.target, webCursor(busy), style]}
    >
      {(state) => {
        const visual = (
          <View
            style={[
              styles.visual,
              layout.visual,
              fillCell ? styles.visualFill : null,
              webTransition,
              compact ? styles.sm : styles.md,
              going ? styles.going : styles.idle,
              webHover(state) && !busy ? styles.hovered : null,
              state.pressed ? styles.pressed : null,
            ]}
          >
            {busy ? (
              <ActivityIndicator size="small" color={fg} />
            ) : going ? (
              <>
                <Icon icon={iconMap.Check} size={14} color={fg} />
                <Text color={fg} style={[styles.label, compact ? styles.labelSm : null, webNoSelect]}>
                  {t("label.going")}
                </Text>
              </>
            ) : (
              <Text color={fg} style={[styles.label, compact ? styles.labelSm : null, webNoSelect]}>
                {t("label.rsvp")}
              </Text>
            )}
          </View>
        )
        return POP_ENABLED ? (
          <Animated.View
            style={[fillCell ? styles.visualFill : null, { transform: [{ scale: popScale }] }]}
          >
            {visual}
          </Animated.View>
        ) : (
          visual
        )
      }}
    </Pressable>
  )
}

const useStyles = makeThemedStyles((t) => ({
  target: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    borderRadius: t.radius.pill,
  },
  targetStretch: {
    alignItems: "stretch",
  },
  visualFill: {
    flexGrow: 1,
  },
  visual: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: t.radius.pill,
  },
  md: {
    paddingHorizontal: t.space["5"],
  },
  sm: {
    paddingHorizontal: t.space["4"],
  },
  idle: {
    backgroundColor: t.colors.brand.bloom,
  },
  going: {
    backgroundColor: t.colors.moss["50"],
  },
  label: {
    fontFamily: t.fontFamily.bodyBold,
    fontSize: 13,
  },
  labelSm: {
    fontSize: 12,
  },
  hovered: {
    opacity: 0.92,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }],
  },
}))
