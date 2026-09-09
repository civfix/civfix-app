import React from "react"
import { View } from "react-native"
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  Extrapolation,
  type SharedValue,
} from "react-native-reanimated"
import { makeThemedStyles, theme, useTheme } from "@/theme"
import { useT } from "@civfix/ui/i18n"
import {
  ONBOARDING_PAGES,
  ONBOARDING_PAGE_COUNT,
  railSegmentState,
} from "@/lib/onboardingPlan"

const SEGMENT_HEIGHT = theme.space["1"]
const SEGMENT_REST_WIDTH = theme.space["5"]
const SEGMENT_ACTIVE_WIDTH = theme.space["10"]

function Segment({
  index,
  current,
  position,
}: {
  index: number
  current: number
  position: SharedValue<number>
}) {
  const th = useTheme()
  const styles = useStyles()
  const restColor =
    railSegmentState(index, current) === "done"
      ? th.colors.brand.moss
      : th.colors.borderStrong
  const activeColor = th.colors.brand.bloom
  const style = useAnimatedStyle(() => {
    const nearness = interpolate(
      Math.abs(position.value - index),
      [0, 1],
      [1, 0],
      Extrapolation.CLAMP,
    )
    return {
      width: interpolate(nearness, [0, 1], [SEGMENT_REST_WIDTH, SEGMENT_ACTIVE_WIDTH]),
      backgroundColor: interpolateColor(nearness, [0, 1], [restColor, activeColor]),
    }
  })
  return <Animated.View style={[styles.segment, style]} />
}

export function StepRail({
  scrollX,
  pageWidth,
  current,
}: {
  scrollX: SharedValue<number>
  pageWidth: number
  current: number
}) {
  const { t } = useT("mobile-onboarding")
  const styles = useStyles()
  const position = useDerivedValue(
    () => (pageWidth > 0 ? scrollX.value / pageWidth : current),
    [pageWidth, current],
  )

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t("a11y.progress", {
        index: current + 1,
        count: ONBOARDING_PAGE_COUNT,
      })}
      accessibilityValue={{ min: 1, max: ONBOARDING_PAGE_COUNT, now: current + 1 }}
    >
      {ONBOARDING_PAGES.map((page, index) => (
        <Segment key={page} index={index} current={current} position={position} />
      ))}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: t.space["2"],
    paddingVertical: t.space["3"],
  },
  segment: {
    height: SEGMENT_HEIGHT,
    borderRadius: t.radius.pill,
  },
}))
