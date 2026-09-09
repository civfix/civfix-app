import React, { useEffect, useRef, useState } from "react"
import { BackHandler, StyleSheet } from "react-native"
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import { makeThemedStyles, theme } from "@/theme"
import { useReducedMotion } from "@civfix/ui/theme"
import { useAuthStore } from "@/store/authStore"
import { ONBOARDING_VERSION, useOnboardingStore } from "@/store/onboardingStore"
import { onboardingBackPlan, onboardingEnterPlan, shouldShowOnboarding } from "@/lib/onboardingPlan"
import { OnboardingPager } from "@/components/onboarding/OnboardingPager"

const ENTER_TIMING = {
  duration: theme.motion.dur.d4,
  easing: Easing.bezier(...theme.motion.easing),
}
const EXIT_FADE_TIMING = {
  duration: theme.motion.dur.d3,
  easing: Easing.bezier(...theme.motion.easing),
}
const EXIT_DROP_TIMING = {
  duration: theme.motion.dur.d3,
  easing: Easing.bezier(...theme.motion.gravity.easing),
}
const REDUCED_TIMING = {
  duration: theme.motion.dur.d2,
  easing: Easing.bezier(...theme.motion.easing),
}
const EXIT_DISTANCE = theme.motion.slideUp.distance

export function OnboardingGate({
  gateActive,
  loadingGateMounted,
}: {
  gateActive: boolean
  loadingGateMounted: boolean
}) {
  const completedVersion = useOnboardingStore((s) => s.completedVersion)
  const replayRequested = useOnboardingStore((s) => s.replayRequested)
  const complete = useOnboardingStore((s) => s.complete)
  const status = useAuthStore((s) => s.status)
  const profileIncomplete = useAuthStore((s) => s.user?.profileComplete === false)
  const reduceMotion = useReducedMotion() === true
  const styles = useStyles()

  const visible = shouldShowOnboarding({
    completedVersion,
    currentVersion: ONBOARDING_VERSION,
    replayRequested,
    fontsReady: !gateActive,
    gateActive,
    authStatus: status,
    profileIncomplete,
  })

  const [mounted, setMounted] = useState(visible)
  const [index, setIndex] = useState(0)
  const fade = useSharedValue(0)
  const drop = useSharedValue(0)
  const setPresenting = useOnboardingStore((s) => s.setPresenting)

  useEffect(() => {
    if (!visible) return
    setMounted(true)
    setIndex(0)
  }, [visible])

  useEffect(() => {
    setPresenting(mounted)
    return () => setPresenting(false)
  }, [mounted, setPresenting])

  useEffect(() => {
    if (!mounted) return
    if (visible) {
      drop.value = 0
      if (onboardingEnterPlan({ loadingGateMounted, reduceMotion }) === "instant") {
        cancelAnimation(fade)
        fade.value = 1
        return
      }
      fade.value = withTiming(1, ENTER_TIMING)
      return
    }
    const fadeTiming = reduceMotion ? REDUCED_TIMING : EXIT_FADE_TIMING
    fade.value = withTiming(0, fadeTiming)
    if (!reduceMotion) drop.value = withTiming(EXIT_DISTANCE, EXIT_DROP_TIMING)
    const unmount = setTimeout(() => setMounted(false), fadeTiming.duration)
    return () => clearTimeout(unmount)
  }, [mounted, visible, reduceMotion, loadingGateMounted, fade, drop])

  useEffect(
    () => () => {
      cancelAnimation(fade)
      cancelAnimation(drop)
    },
    [fade, drop],
  )

  const wasAuthed = useRef(status === "authed")
  useEffect(() => {
    const authed = status === "authed"
    if (mounted && authed && !wasAuthed.current) complete()
    wasAuthed.current = authed
  }, [mounted, status, complete])

  const indexRef = useRef(index)
  useEffect(() => {
    indexRef.current = index
  }, [index])

  useEffect(() => {
    if (!visible) return
    const onBackPress = (): boolean => {
      const plan = onboardingBackPlan(indexRef.current)
      if (plan.type === "previous") setIndex(plan.to)
      return true
    }
    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress)
    return () => subscription.remove()
  }, [visible])

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: drop.value }],
  }))

  if (!mounted) return null

  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      accessibilityViewIsModal={visible}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
      style={[styles.overlay, overlayStyle]}
    >
      <OnboardingPager
        index={index}
        onIndexChange={setIndex}
        reduceMotion={reduceMotion}
        onComplete={complete}
      />
    </Animated.View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: t.colors.bg,
    zIndex: 40,
    elevation: 40,
  },
}))
