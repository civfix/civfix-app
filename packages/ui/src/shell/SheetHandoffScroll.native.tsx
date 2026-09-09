/**
 * SheetHandoffScroll (native seam) — hand a DOWNWARD drag at the top of a sheet body's content over to
 * the compact sheet, so pulling down on content collapses the pull-up sheet (iOS-modal behaviour).
 *
 * WHY NOT gorhom's OWN integration: its handoff is inseparable from its scroll LOCK — useScrollable
 * returns SCROLLABLE_STATUS.LOCKED at every detent except the exact-equality EXTENDED one, and while
 * LOCKED it force-scrollTo's the content back every frame AND pins decelerationRate to 0. Details open
 * at MID, so adopting it reproduces the round-5 regression this shell already paid to fix. So:
 * `enableContentPanningGesture` STAYS false (which pins gorhom's status UNLOCKED unconditionally), the
 * scrollables stay PLAIN RN, and the handoff is done here.
 *
 * TOPOLOGY: gorhom's own, verified at createBottomSheetScrollableComponent.tsx:88-97 —
 * `Gesture.Native().simultaneousWithExternalGesture(pan)` on the scrollable, Pan on an ANCESTOR view.
 *
 * SETTLE: explicit. gorhom's animateToPosition early-returns on `position === animatedPosition.get()`
 * BEFORE emitting onAnimate/onChange, and both handleOnAnimate and handleOnChange are additionally
 * gated on `animatedCurrentIndex`, which is stale for the whole duration of any animation we interrupt.
 * So we (a) never land the DRAG exactly on a detent (FLOOR_EPSILON) and (b) runOnJS an explicit settle
 * alongside animateToPosition. Both settle paths are idempotent, so a genuine onChange double-firing is
 * harmless.
 *
 * HORIZONTAL scrollables pass through untouched. NESTED VERTICAL scrollables inside a sheet body must be
 * given their own <ScrollHostProvider value={PLAIN_SCROLL_HOST}> (the GroupInfoBody.tsx:528 pattern).
 */
import React, { forwardRef, useMemo } from "react"
import { View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, { runOnJS, useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated"
import { useBottomSheetInternal, ANIMATION_SOURCE } from "@gorhom/bottom-sheet"
import { useNavStore, type Snap } from "../nav"
import type { ScrollHostValue } from "./ScrollHost"
import {
  HANDOFF_SLOP,
  handoffDestinationIndex,
  handoffPosition,
  shouldEngageHandoff,
} from "./sheetHandoffLogic"

/** JS-thread settle. Idempotent; safe to double-fire with gorhom's own onChange. */
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
    /** The position the sheet held when the pan ENGAGED. Unlike `basePosition` (which onUpdate rolls
     *  forward every frame the list is still consuming the drag) this is written ONCE, in onStart, so it
     *  is the only value onEnd can safely ask "did the sheet actually leave its detent?" against. */
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
          wasAnimating.value = animatedAnimationState.get().status === 1 /* RUNNING */
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
          // Compared against `engagedFrom`, NOT `basePosition`. basePosition is REBASELINED to the live
          // `animatedPosition` on every frame the list is consuming the drag (see onUpdate), so a gesture
          // that drags the sheet down, reverses far enough to scroll the content, and is then released
          // would read `moved === false` while the sheet sits OFF its detent — no settle animation, a
          // fractional animatedIndex (body fade / header float frozen mid-way), and `useNavStore.snap`
          // stuck on the old index, which CompactShell's re-sync effect cannot correct either.
          const moved = animatedPosition.value > engagedFrom.value
          if (!moved && !wasAnimating.value) return
          const detents = animatedDetentsState.get().detents
          if (!detents || detents.length === 0) return
          const i = handoffDestinationIndex(animatedPosition.value, e.velocityY, detents)
          const dest = i >= 0 ? detents[i] : undefined
          if (dest === undefined) return
          animateToPosition(dest, ANIMATION_SOURCE.GESTURE, e.velocityY / 2)
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
        <View style={{ flex: 1 }}>
          <GestureDetector gesture={native}>
            <AnimatedBase
              ref={ref}
              onScroll={scrollHandler}
              // 16, NOT 32: the reanimated worklet must have a current UI-thread offset for the
              // engage gate. The JS-thread cost Area 1 worried about is addressed in MinimizeAwareScroll.
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

/** Wrap a ScrollHost so BOTH its ScrollView and FlatList hand a top-of-content pull-down to the sheet.
 *  Uses Animated.ScrollView / Animated.FlatList rather than createAnimatedComponent — the latter carries
 *  an explicit @deprecated for FlatList in reanimated 4, and Animated.FlatList also defaults
 *  scrollEventThrottle sensibly and supplies a CellRendererComponent. */
export function makeSheetHandoffScrollHost(base: ScrollHostValue): ScrollHostValue {
  return {
    ScrollView: makeSheetHandoffScroll(base.ScrollView, Animated.ScrollView as any),
    FlatList: makeSheetHandoffScroll(base.FlatList, Animated.FlatList as any),
  }
}
