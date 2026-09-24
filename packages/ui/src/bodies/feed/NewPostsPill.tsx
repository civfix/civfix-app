import React, { useEffect, useRef } from "react"
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet } from "react-native"
import { focusRingProps, makeThemedStyles, motion, useTheme, MIN_TOUCH_TARGET } from "../../theme"
import { useReducedMotion } from "../../theme/useReducedMotion"
import { Icon, Text, iconMap } from "../../typography"
import { useT } from "../../i18n"
import { shouldAnnounceNewPosts } from "../../data/feedLiveModel"

const ENTER = motion.fadeUp
const USE_NATIVE_DRIVER = Platform.OS !== "web"
const LIVE_REGION: "polite" | "none" = Platform.OS === "web" ? "polite" : "none"
const ANNOUNCES_NATIVELY = Platform.OS !== "web"

export function NewPostsPill({ count, onPress }: { count: number; onPress: () => void }) {
  const styles = useStyles()
  const th = useTheme()
  const { t } = useT("home-feed")
  const reducedMotion = useReducedMotion() === true
  const progress = useRef(new Animated.Value(0)).current
  const visible = count > 0
  const label = t("feed.new_posts", { count })
  const previousCountRef = useRef(0)

  useEffect(() => {
    const previous = previousCountRef.current
    previousCountRef.current = count
    if (ANNOUNCES_NATIVELY && shouldAnnounceNewPosts(previous, count)) {
      AccessibilityInfo.announceForAccessibility(label)
    }
  }, [count, label])

  useEffect(() => {
    if (!visible) {
      progress.setValue(0)
      return
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: ENTER.duration,
      easing: Easing.bezier(...ENTER.easing),
      useNativeDriver: USE_NATIVE_DRIVER,
    })
    animation.start()
    return () => animation.stop()
  }, [visible, progress])

  if (!visible) return null

  const motionStyle = reducedMotion
    ? { opacity: progress }
    : {
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [-ENTER.distance, 0],
            }),
          },
        ],
      }

  return (
    <Animated.View style={[styles.slot, motionStyle]} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityLiveRegion={LIVE_REGION}
        onPress={onPress}
        {...focusRingProps}
        style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
      >
        <Icon icon={iconMap.ArrowUp} size={16} color={th.colors.accent} />
        <Text variant="bodyStrong" color={th.colors.text} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  slot: {
    position: "absolute",
    top: t.space["3"],
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: t.space["4"],
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: t.space["2"],
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: t.space["2"],
    paddingHorizontal: t.space["4"],
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    ...t.shadows.s3,
  },
  cardPressed: { opacity: 0.7 },
}))
