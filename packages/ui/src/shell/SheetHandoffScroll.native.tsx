/**
 * SheetHandoffScroll (native seam): hands a downward drag at the top of a sheet body's content to the
 * compact sheet, so pulling down on content collapses it the way an iOS modal does.
 *
 * gorhom's own integration is not used because its handoff is inseparable from its scroll lock (see
 * CompactShell.native), so `enableContentPanningGesture` stays false, the scrollables stay plain RN, and
 * the handoff is done here with gorhom's own topology (createBottomSheetScrollableComponent): a
 * `Gesture.Native().simultaneousWithExternalGesture(pan)` on the scrollable and the Pan on an ancestor.
 *
 * The settle is explicit: gorhom's animateToPosition early-returns on `position ===
 * animatedPosition.get()` before emitting onAnimate/onChange, and both are also gated on
 * `animatedCurrentIndex`, which is stale for any animation we interrupt. So the drag never lands exactly
 * on a detent (FLOOR_EPSILON) and an idempotent settle runs alongside animateToPosition.
 *
 * Horizontal scrollables pass through untouched.
 */
import React, { forwardRef, useMemo } from "react"
import { View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, { runOnJS, useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated"
import { useBottomSheetInternal, ANIMATION_SOURCE, ANIMATION_STATUS } from "@gorhom/bottom-sheet"
import { useNavStore, type Snap } from "../nav"
import type { ScrollHostValue } from "./ScrollHost"
import {
  HANDOFF_SLOP,
  handoffDestinationIndex,
  handoffPosition,
  shouldEngageHandoff,
} from "./sheetHandoffLogic"

const RELEASE_VELOCITY_DIVISOR = 2
const FILL = { flex: 1 } as const

/** Idempotent, so double-firing with gorhom's own onChange is harmless. */
function settleToSnap(index: number) {
  const nav = useNavStore.getState()
  if (index === 0 && nav.active !== null) nav.collapseToParent()
  else nav.setSnap(index as Snap)
}

function makeSheetHandoffScroll(
  Base: React.ComponentType<any>,
  AnimatedBase: React.ComponentType<any>,
): React.ComponentType<any> {
  const SheetHandoffScroll = forwardRef<any, any>(function SheetHandoffScroll(
    { onScroll, scrollEventThrottle, horizontal, ...rest },
    ref,
  ) {
    const {
      animatedPosition,
      animatedDetentsState,
      animatedAnimationState,
      animateToPosition,
      stopAnimation,
    } = useBottomSheetInternal()

    const scrollY = useSharedValue(0)
    const touchStartY = useSharedValue(0)
    const touchStartX = useSharedValue(0)
    const activePointer = useSharedValue(0)
    const engaged = useSharedValue(false)
    const basePosition = useSharedValue(0)
    const baseTranslation = useSharedValue(0)
    const wasAnimating = useSharedValue(false)
    /** Written once in onStart, unlike `basePosition`, which onUpdate re-baselines every frame the list
     *  consumes the drag, so it is the only safe reference for "did the sheet leave its detent?". */
    const engagedFrom = useSharedValue(0)

    const scrollHandler = useAnimatedScrollHandler(
      {
        onScroll: (e) => {
          "worklet"
          scrollY.value = e.contentOffset.y
          // gorhom's own payload shape; both consumers read only e.nativeEvent.contentOffset.y.
          if (onScroll) runOnJS(onScroll)({ nativeEvent: e })
        },
      },
      [onScroll],
    )

    const { pan, native } = useMemo(() => {
      const p = Gesture.Pan()
        .runOnJS(false)
        .manualActivation(true)
        .shouldCancelWhenOutside(false)
        .onTouchesDown((e) => {
          "worklet"
          // onTouchesDown fires for EVERY new pointer. Only the FIRST arms the handoff, or a second
          // finger landing mid-drag resets `engaged` and rebases to the wrong touch.
          if (e.numberOfTouches > 1) return
          engaged.value = false
          activePointer.value = 1
          touchStartY.value = e.allTouches[0] ? e.allTouches[0].absoluteY : 0
          touchStartX.value = e.allTouches[0] ? e.allTouches[0].absoluteX : 0
        })
        .onTouchesMove((e, state) => {
          "worklet"
          if (engaged.value || activePointer.value === 0) return
          const t = e.allTouches[0]
          if (!t) return
          // dx is passed so a swipe across a nested horizontal strip (which this host does NOT wrap, so
          // the `horizontal` pass-through below never sees it) cannot be stolen by its downward drift.
          if (
            shouldEngageHandoff(
              scrollY.value,
              t.absoluteY - touchStartY.value,
              HANDOFF_SLOP,
              t.absoluteX - touchStartX.value,
            )
          ) {
            state.activate()
          }
        })
        .onStart((e) => {
          "worklet"
          // Capture BEFORE cancelling: an interrupted animation MUST still be settled on release, or
          // the sheet is parked off-detent with no recovery path.
          wasAnimating.value = animatedAnimationState.get().status === ANIMATION_STATUS.RUNNING
          stopAnimation()
          engaged.value = true
          basePosition.value = animatedPosition.value
          engagedFrom.value = animatedPosition.value
          baseTranslation.value = e.translationY
        })
        .onUpdate((e) => {
          "worklet"
          const st = animatedDetentsState.get()
          const detents = st.detents
          const highest = st.highestDetentPosition
          if (!detents || detents.length === 0 || highest === undefined) return
          const lowest = detents[0]
          if (lowest === undefined) return
          if (scrollY.value > 0) {
            basePosition.value = animatedPosition.value
            baseTranslation.value = e.translationY
            return
          }
          animatedPosition.value = handoffPosition(
            basePosition.value,
            e.translationY,
            baseTranslation.value,
            highest,
            lowest,
          )
        })
        .onEnd((e) => {
          "worklet"
          // Against `basePosition`, a drag down that reverses into a content scroll before release would
          // read unmoved while the sheet sits off its detent: no settle, a fractional animatedIndex and
          // a stale store snap that CompactShell's re-sync cannot correct.
          const moved = animatedPosition.value > engagedFrom.value
          if (!moved && !wasAnimating.value) return
          const detents = animatedDetentsState.get().detents
          if (!detents || detents.length === 0) return
          const i = handoffDestinationIndex(animatedPosition.value, e.velocityY, detents)
          const dest = i >= 0 ? detents[i] : undefined
          if (dest === undefined) return
          animateToPosition(dest, ANIMATION_SOURCE.GESTURE, e.velocityY / RELEASE_VELOCITY_DIVISOR)
          runOnJS(settleToSnap)(i)
        })
        .onFinalize(() => {
          "worklet"
          engaged.value = false
          activePointer.value = 0
          wasAnimating.value = false
        })
      const n = Gesture.Native().simultaneousWithExternalGesture(p).shouldCancelWhenOutside(false)
      return { pan: p, native: n }
    }, [
      animatedPosition,
      animatedDetentsState,
      animatedAnimationState,
      animateToPosition,
      stopAnimation,
      scrollY,
      touchStartY,
      touchStartX,
      activePointer,
      engaged,
      basePosition,
      baseTranslation,
      wasAnimating,
      engagedFrom,
    ])

    if (horizontal) {
      return (
        <Base
          ref={ref}
          horizontal
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle ?? 16}
          {...rest}
        />
      )
    }

    return (
      <GestureDetector gesture={pan}>
        <View style={FILL}>
          <GestureDetector gesture={native}>
            <AnimatedBase
              ref={ref}
              onScroll={scrollHandler}
              // 16, not 32: the engage gate needs a current UI-thread offset. The JS-thread cost is
              // handled in MinimizeAwareScroll.
              scrollEventThrottle={scrollEventThrottle ?? 16}
              bounces={false}
              alwaysBounceVertical={false}
              overScrollMode="never"
              {...rest}
            />
          </GestureDetector>
        </View>
      </GestureDetector>
    )
  })
  SheetHandoffScroll.displayName = "SheetHandoffScroll"
  return SheetHandoffScroll as unknown as React.ComponentType<any>
}

/** Uses Animated.ScrollView / Animated.FlatList rather than createAnimatedComponent, which is deprecated
 *  for FlatList in reanimated 4; Animated.FlatList also supplies a CellRendererComponent. */
export function makeSheetHandoffScrollHost(base: ScrollHostValue): ScrollHostValue {
  return {
    ScrollView: makeSheetHandoffScroll(base.ScrollView, Animated.ScrollView as any),
    FlatList: makeSheetHandoffScroll(base.FlatList, Animated.FlatList as any),
  }
}
