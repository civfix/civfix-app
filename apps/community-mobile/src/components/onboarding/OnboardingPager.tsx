import React, { useCallback, useEffect, useRef } from "react"
import {
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Animated, {
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated"
import { makeThemedStyles } from "@/theme"
import { announce } from "@civfix/ui"
import { useT } from "@civfix/ui/i18n"
import { useHaptics } from "@civfix/ui/capabilities"
import {
  ONBOARDING_LAST_INDEX,
  ONBOARDING_PAGES,
  ONBOARDING_PAGE_COUNT,
  clampPageIndex,
  pageIndexForOffset,
  skipVisible,
} from "@/lib/onboardingPlan"
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader"
import { OnboardingFooter } from "@/components/onboarding/OnboardingFooter"
import { StepRail } from "@/components/onboarding/StepRail"
import { ReportPage } from "@/components/onboarding/pages/ReportPage"
import { TrackPage } from "@/components/onboarding/pages/TrackPage"
import { TogetherPage } from "@/components/onboarding/pages/TogetherPage"
import { ThemePage } from "@/components/onboarding/pages/ThemePage"
import { ReadyPage } from "@/components/onboarding/pages/ReadyPage"

export interface OnboardingPagerProps {
  index: number
  onIndexChange: (next: number) => void
  reduceMotion: boolean
  onComplete: () => void
}

export function OnboardingPager({
  index,
  onIndexChange,
  reduceMotion,
  onComplete,
}: OnboardingPagerProps) {
  const { t } = useT("mobile-onboarding")
  const styles = useStyles()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const haptics = useHaptics()

  const scrollRef = useAnimatedRef<Animated.ScrollView>()
  const scrollX = useSharedValue(0)
  const settledRef = useRef(index)
  const widthRef = useRef(width)

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      "worklet"
      scrollX.value = event.contentOffset.x
    },
  })

  useEffect(() => {
    if (width <= 0) return
    const resized = widthRef.current !== width
    widthRef.current = width
    if (!resized && settledRef.current === index) return
    settledRef.current = index
    scrollRef.current?.scrollTo({ x: index * width, animated: !reduceMotion && !resized })
  }, [index, width, reduceMotion, scrollRef])

  useEffect(() => {
    const page = ONBOARDING_PAGES[index]
    if (!page) return
    announce(
      t("a11y.page_announce", {
        index: index + 1,
        count: ONBOARDING_PAGE_COUNT,
        title: t(`${page}.title`),
      }),
    )
  }, [index, t])

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = pageIndexForOffset(event.nativeEvent.contentOffset.x, width)
      settledRef.current = next
      if (next === index) return
      haptics.selection()
      onIndexChange(next)
    },
    [width, index, haptics, onIndexChange],
  )

  const goTo = useCallback(
    (next: number) => {
      const target = clampPageIndex(next)
      if (target === index) return
      onIndexChange(target)
    },
    [index, onIndexChange],
  )

  const onNext = useCallback(() => {
    haptics.impactLight()
    goTo(index + 1)
  }, [haptics, goTo, index])

  const onBack = useCallback(() => {
    haptics.impactLight()
    goTo(index - 1)
  }, [haptics, goTo, index])

  const canSkip = skipVisible(index)

  const onSkip = useCallback(() => {
    if (!skipVisible(index)) return
    haptics.selection()
    goTo(ONBOARDING_LAST_INDEX)
  }, [haptics, goTo, index])

  const pageProps = { scrollX, pageWidth: width, reduceMotion }

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <OnboardingHeader page={index} showSkip={canSkip} onSkip={onSkip} />
      <StepRail scrollX={scrollX} pageWidth={width} current={index} />
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        onMomentumScrollEnd={onMomentumScrollEnd}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        style={styles.scroll}
      >
        <ReportPage {...pageProps} index={0} active={index === 0} />
        <TrackPage {...pageProps} index={1} active={index === 1} />
        <TogetherPage {...pageProps} index={2} active={index === 2} />
        <ThemePage {...pageProps} index={3} active={index === 3} />
        <ReadyPage {...pageProps} index={4} active={index === 4} onComplete={onComplete} />
      </Animated.ScrollView>
      {index < ONBOARDING_LAST_INDEX ? (
        <OnboardingFooter canGoBack={index > 0} onNext={onNext} onBack={onBack} />
      ) : null}
    </View>
  )
}

const useStyles = makeThemedStyles((t) => ({
  root: {
    flex: 1,
    backgroundColor: t.colors.bg,
    gap: t.space["2"],
  },
  scroll: {
    flex: 1,
  },
}))
