import React from "react"
import { StyleSheet, View } from "react-native"
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from "react-native-reanimated"
import { TeardropPin } from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"
import { makeThemedStyles } from "@/theme"
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

const TOTAL_MS = 5200

const W_CARD = stageWindow(TOTAL_MS, 0, 460)
const W_HEAD = stageWindow(TOTAL_MS, 360, 780)
const W_LINES = stageWindow(TOTAL_MS, 700, 1160)

const PIN_SIZE = 26
const PREVIEW_CATEGORY = "graffiti"

export function ThemeStage({ active, reduceMotion }: StageProps) {
  const { t } = useT("mobile-onboarding")
  const styles = useStyles()
  const progress = useStageTimeline(active, reduceMotion, TOTAL_MS)

  const cardStyle = useAnimatedStyle(() => {
    const s = GRAVITY_EASE(segment(progress.value, W_CARD[0], W_CARD[1]))
    return {
      opacity: interpolate(s, [0, 0.25], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateY: (s - 1) * STAGE_DROP_PX }],
    }
  })

  const headStyle = useAnimatedStyle(() => {
    const s = STANDARD_EASE(segment(progress.value, W_HEAD[0], W_HEAD[1]))
    return { opacity: s, transform: [{ translateY: (1 - s) * STAGE_RISE_PX }] }
  })

  const linesStyle = useAnimatedStyle(() => {
    const s = STANDARD_EASE(segment(progress.value, W_LINES[0], W_LINES[1]))
    return { opacity: s, transform: [{ translateY: (1 - s) * STAGE_RISE_PX }] }
  })

  return (
    <View
      pointerEvents="none"
      accessible
      accessibilityLabel={t("a11y.stage_theme")}
      style={styles.root}
    >
      <View
        style={styles.inner}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Animated.View style={[styles.card, cardStyle]}>
          <Animated.View style={[styles.head, headStyle]}>
            <TeardropPin category={PREVIEW_CATEGORY} size={PIN_SIZE} />
            <View style={styles.headLines}>
              <View style={[styles.line, styles.lineTitle]} />
              <View style={[styles.line, styles.lineMeta]} />
            </View>
          </Animated.View>
          <Animated.View style={[styles.body, linesStyle]}>
            <View style={[styles.line, styles.lineFull]} />
            <View style={[styles.line, styles.lineShort]} />
          </Animated.View>
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
  },
  card: {
    alignSelf: "stretch",
    marginHorizontal: t.space["4"],
    padding: t.space["4"],
    gap: t.space["4"],
    borderRadius: t.radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.space["3"],
  },
  headLines: {
    flex: 1,
    gap: t.space["2"],
  },
  body: {
    gap: t.space["2"],
  },
  line: {
    height: 8,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.bgAlt,
  },
  lineTitle: {
    width: "70%",
    backgroundColor: t.colors.borderStrong,
  },
  lineMeta: {
    width: "40%",
  },
  lineFull: {
    alignSelf: "stretch",
  },
  lineShort: {
    width: "60%",
  },
}))
