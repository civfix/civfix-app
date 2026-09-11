import React from "react"
import { StyleSheet, View } from "react-native"
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from "react-native-reanimated"
import { Avatar, Text } from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"
import { makeThemedStyles, motion, useTheme } from "@/theme"
import {
  GRAVITY_EASE,
  STAGE_DROP_PX,
  STAGE_RISE_PX,
  STANDARD_EASE,
  segment,
  stageWindow,
  useStageTimeline,
} from "./stageMotion"
import type { StageProps } from "./stageTypes"

const TOTAL_MS = 6400

const W_PLACEHOLDER = stageWindow(TOTAL_MS, 0, 420)
const W_CROSSFADE = stageWindow(TOTAL_MS, 900, 1320)
const W_POP = stageWindow(TOTAL_MS, 900, 1500)
const W_HANDLE = stageWindow(TOTAL_MS, 1400, 1760)

const AVATAR_SIZE = 64
const PLACEHOLDER_NAME = "?"
const POP = motion.pop

export function ReadyStage({ active, reduceMotion }: StageProps) {
  const { t } = useT("mobile-onboarding")
  const th = useTheme()
  const styles = useStyles()
  const coral: readonly [string, string] = [th.colors.brand.bloom, th.colors.bloom["600"]]
  const progress = useStageTimeline(active, reduceMotion, TOTAL_MS)
  const ghostHandle = t("ready.handle_ghost")

  const placeholderStyle = useAnimatedStyle(() => {
    const enter = GRAVITY_EASE(segment(progress.value, W_PLACEHOLDER[0], W_PLACEHOLDER[1]))
    const leave = segment(progress.value, W_CROSSFADE[0], W_CROSSFADE[1])
    return {
      opacity: interpolate(enter, [0, 0.3, 1], [0, 1, 1], Extrapolation.CLAMP) * (1 - leave),
      transform: [{ translateY: (enter - 1) * STAGE_DROP_PX }],
    }
  })

  const monogramStyle = useAnimatedStyle(() => {
    const s = segment(progress.value, W_POP[0], W_POP[1])
    return {
      opacity: segment(progress.value, W_CROSSFADE[0], W_CROSSFADE[1]),
      transform: [
        { scale: interpolate(s, [0, 0.55, 1], [POP.from, POP.overshoot, POP.to], Extrapolation.CLAMP) },
      ],
    }
  })

  const handleStyle = useAnimatedStyle(() => {
    const s = STANDARD_EASE(segment(progress.value, W_HANDLE[0], W_HANDLE[1]))
    return { opacity: s, transform: [{ translateY: (1 - s) * STAGE_RISE_PX }] }
  })

  return (
    <View
      pointerEvents="none"
      accessible
      accessibilityLabel={t("a11y.stage_ready")}
      style={styles.root}
    >
      <View
        style={styles.inner}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={styles.avatarSlot}>
          <Animated.View style={[StyleSheet.absoluteFill, placeholderStyle]}>
            <Avatar name={PLACEHOLDER_NAME} size={AVATAR_SIZE} decorative />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, monogramStyle]}>
            <Avatar name={ghostHandle} gradient={coral} size={AVATAR_SIZE} decorative />
          </Animated.View>
        </View>
        <Animated.View style={handleStyle}>
          <Text variant="mono" color={th.colors.textSubtle}>
            {ghostHandle}
          </Text>
        </Animated.View>
      </View>
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: {
    width: "100%",
  },
  inner: {
    alignItems: "center",
    gap: t.space["2"],
  },
  avatarSlot: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
}))
