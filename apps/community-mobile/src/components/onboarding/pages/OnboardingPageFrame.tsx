import React from "react"
import { KeyboardAvoidingView, Platform, View } from "react-native"
import Animated, {
  interpolate,
  useAnimatedKeyboard,
  useAnimatedStyle,
  Extrapolation,
  type SharedValue,
} from "react-native-reanimated"
import { makeThemedStyles, useTheme } from "@/theme"
import { Text } from "@civfix/ui"

const STAGE_PARALLAX = 0.35
const COPY_PARALLAX = 0.15
const SCALE_FROM = 0.92
const IOS_KEYBOARD_BEHAVIOR = Platform.OS === "ios" ? "padding" : undefined
const TRACKS_KEYBOARD_HEIGHT = Platform.OS === "android"

export interface OnboardingPageProps {
  index: number
  scrollX: SharedValue<number>
  pageWidth: number
  active: boolean
  reduceMotion: boolean
}

function KeyboardAwarePage({ children }: { children: React.ReactNode }) {
  const styles = useStyles()
  const keyboard = useAnimatedKeyboard()
  const shrinkStyle = useAnimatedStyle(() => ({
    marginBottom: TRACKS_KEYBOARD_HEIGHT ? keyboard.height.value : 0,
  }))
  return (
    <KeyboardAvoidingView style={styles.fill} behavior={IOS_KEYBOARD_BEHAVIOR}>
      <Animated.View style={[styles.fill, shrinkStyle]}>{children}</Animated.View>
    </KeyboardAvoidingView>
  )
}

export interface OnboardingPageFrameProps extends OnboardingPageProps {
  stage: React.ReactNode
  title: string
  body: string
  caption?: string
  avoidKeyboard?: boolean
  children?: React.ReactNode
}

export function OnboardingPageFrame({
  index,
  scrollX,
  pageWidth,
  active,
  reduceMotion,
  stage,
  title,
  body,
  caption,
  avoidKeyboard = false,
  children,
}: OnboardingPageFrameProps) {
  const th = useTheme()
  const styles = useStyles()
  const stageStyle = useAnimatedStyle(() => {
    if (reduceMotion || pageWidth <= 0) return { opacity: 1, transform: [] }
    const delta = scrollX.value / pageWidth - index
    const distance = Math.abs(delta)
    return {
      opacity: interpolate(distance, [0, 1], [1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: delta * pageWidth * STAGE_PARALLAX },
        { scale: interpolate(distance, [0, 1], [1, SCALE_FROM], Extrapolation.CLAMP) },
      ],
    }
  })

  const copyStyle = useAnimatedStyle(() => {
    if (reduceMotion || pageWidth <= 0) return { opacity: 1, transform: [] }
    const delta = scrollX.value / pageWidth - index
    const distance = Math.abs(delta)
    return {
      opacity: interpolate(distance, [0, 1], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateX: delta * pageWidth * COPY_PARALLAX }],
    }
  })

  const scroll = (
    <Animated.ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View style={[styles.stage, stageStyle]}>{stage}</Animated.View>
      <Animated.View style={[styles.copy, copyStyle]}>
        <Text variant="display" style={styles.title}>
          {title}
        </Text>
        <Text variant="body" color={th.colors.textMuted} style={styles.body}>
          {body}
        </Text>
        {caption ? (
          <Text variant="caption" color={th.colors.textSubtle} style={styles.body}>
            {caption}
          </Text>
        ) : null}
        {children}
      </Animated.View>
    </Animated.ScrollView>
  )

  return (
    <View
      style={[styles.page, { width: pageWidth }]}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? "auto" : "no-hide-descendants"}
    >
      {avoidKeyboard ? <KeyboardAwarePage>{scroll}</KeyboardAwarePage> : scroll}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  page: {
    alignSelf: "stretch",
  },
  fill: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: t.space["5"],
    paddingVertical: t.space["4"],
    gap: t.space["6"],
  },
  stage: {
    alignSelf: "stretch",
  },
  copy: {
    alignSelf: "stretch",
    gap: t.space["3"],
  },
  title: {
    textAlign: "center",
  },
  body: {
    textAlign: "center",
    lineHeight: t.lineHeight.loose * t.fontSize["15"],
  },
}))
