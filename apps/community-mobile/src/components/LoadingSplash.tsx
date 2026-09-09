import React, { useEffect } from "react"
import { View, StyleSheet, useWindowDimensions, type TextStyle } from "react-native"
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useReducedMotion,
  withTiming,
  withDelay,
  withRepeat,
  interpolate,
  cancelAnimation,
  Easing,
} from "react-native-reanimated"
import Svg, { Defs, RadialGradient, Stop, Rect } from "react-native-svg"
import { makeThemedStyles, useTheme, wordmarkColors, WORDMARK_LETTERS } from "@/theme"
import { Text } from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"

const DROP_DURATION = 880
const DROP_STAGGER = 80
const DROP_TRIGGER_DELAY = 80
const EASE_OVERSHOOT = Easing.bezier(0.34, 1.56, 0.64, 1)

const BOUNCE_DURATION = 1150
const BOUNCE_STAGGER = 90
const BOUNCE_START_DELAY = 1450
const EASE_BOUNCE = Easing.bezier(0.28, 0.84, 0.42, 1)

const TAG_DURATION = 640
const TAG_DELAY = 760

function wordmarkSize(width: number): number {
  return Math.max(72, Math.min(width * 0.22, 112))
}

function Letter({
  char,
  color,
  index,
  fontSize,
  dropDistance,
  reduceMotion,
}: {
  char: string
  color: string
  index: number
  fontSize: number
  dropDistance: number
  reduceMotion: boolean
}) {
  const styles = useStyles()
  const drop = useSharedValue(reduceMotion ? 1 : 0)
  const bounce = useSharedValue(0)

  useEffect(() => {
    if (reduceMotion) {
      drop.value = 1
      return
    }
    drop.value = withDelay(
      DROP_TRIGGER_DELAY + index * DROP_STAGGER,
      withTiming(1, { duration: DROP_DURATION, easing: EASE_OVERSHOOT }),
    )
    bounce.value = withDelay(
      BOUNCE_START_DELAY + index * BOUNCE_STAGGER,
      withRepeat(withTiming(1, { duration: BOUNCE_DURATION, easing: EASE_BOUNCE }), -1),
    )
    return () => {
      cancelAnimation(drop)
      cancelAnimation(bounce)
    }
  }, [reduceMotion, index, drop, bounce])

  const style = useAnimatedStyle(() => {
    const enterY = (1 - drop.value) * -dropDistance
    const opacity = interpolate(drop.value, [0, 0.25, 1], [0, 1, 1])
    const bounceY = interpolate(
      bounce.value,
      [0, 0.2, 0.32, 0.42, 0.6, 1],
      [0, -fontSize * 0.22, 0, 0, 0, 0],
    )
    const scaleY = interpolate(
      bounce.value,
      [0, 0.2, 0.32, 0.42, 0.6, 1],
      [1, 1.04, 0.92, 1, 1, 1],
    )
    return {
      opacity,
      transform: [{ translateY: enterY + bounceY }, { scaleY }],
    }
  })

  return (
    <Animated.Text
      style={[styles.letter, { color, fontSize, letterSpacing: -fontSize * 0.05 }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      {char}
    </Animated.Text>
  )
}

function Tagline({ reduceMotion }: { reduceMotion: boolean }) {
  const { t } = useT("mobile-branding")
  const styles = useStyles()
  const fall = useSharedValue(reduceMotion ? 1 : 0)
  useEffect(() => {
    if (reduceMotion) {
      fall.value = 1
      return
    }
    fall.value = withDelay(
      TAG_DELAY,
      withTiming(1, { duration: TAG_DURATION, easing: EASE_OVERSHOOT }),
    )
    return () => cancelAnimation(fall)
  }, [reduceMotion, fall])

  const style = useAnimatedStyle(() => ({
    opacity: fall.value,
    transform: [{ translateY: (1 - fall.value) * -40 }],
  }))

  return (
    <Animated.View style={style}>
      <Text style={styles.tag}>{t("nonprofit_tagline")}</Text>
    </Animated.View>
  )
}

function GlowBackground() {
  const th = useTheme()
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="cf-sun" cx="0.5" cy="0.16" rx="0.9" ry="0.6">
          <Stop offset="0" stopColor={th.colors.sun["50"]} stopOpacity={1} />
          <Stop offset="0.6" stopColor={th.colors.sun["50"]} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="cf-moss" cx="0.5" cy="1.02" rx="0.8" ry="0.5">
          <Stop offset="0" stopColor={th.colors.moss["50"]} stopOpacity={1} />
          <Stop offset="0.55" stopColor={th.colors.moss["50"]} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#cf-sun)" />
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#cf-moss)" />
    </Svg>
  )
}

export function LoadingSplash() {
  const { t } = useT("mobile-branding")
  const styles = useStyles()
  const { width, height } = useWindowDimensions()
  const reduceMotion = useReducedMotion()
  const fontSize = wordmarkSize(width)
  const dropDistance = height * 1.18

  return (
    <View style={styles.root}>
      <GlowBackground />
      <View
        style={styles.row}
        accessibilityRole="header"
        accessibilityLabel={t("a11y.brand_logo")}
      >
        {WORDMARK_LETTERS.map((char, i) => (
          <Letter
            key={`${char}-${i}`}
            char={char}
            color={wordmarkColors[i]!}
            index={i}
            fontSize={fontSize}
            dropDistance={dropDistance}
            reduceMotion={reduceMotion}
          />
        ))}
      </View>
      <Tagline reduceMotion={reduceMotion} />
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: t.colors.bg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  letter: {
    fontFamily: t.fontFamily.brand,
    includeFontPadding: false,
  } as TextStyle,
  tag: {
    marginTop: t.space["6"],
    fontFamily: t.fontFamily.bodyExtraBold,
    fontSize: t.fontSize["13"],
    letterSpacing: t.fontSize["13"] * 0.12,
    textTransform: "uppercase",
    textAlign: "center",
    color: t.colors.textSubtle,
  },
}))
