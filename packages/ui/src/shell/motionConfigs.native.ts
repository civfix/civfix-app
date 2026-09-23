/**
 * Reanimated adapters for the shared motion vocabulary.
 *
 * Every factory returns a fresh object literal so the frozen theme token can never be reached, even though
 * gorhom's animate() only writes `configs.reduceMotion` when `overrideReduceMotion` is truthy.
 *
 * gorhom (5.2.14) detects timing vs spring with `'duration' in configs || 'easing' in configs`, so a
 * reanimated duration-spring ({duration, dampingRatio}) is misread as a timing: any spring handed to
 * gorhom must use the mass/stiffness/damping form. `velocity` reaches only withSpring, never withTiming.
 *
 * Every factory in this module is JS-THREAD ONLY. Call it in render, useMemo or useEffect and capture the
 * result; never call one inside a worklet (a Gesture callback, useAnimatedStyle, useDerivedValue,
 * useAnimatedReaction, useAnimatedScrollHandler). They cannot be worklets because `timingConfig` reaches
 * through the whole `theme` object. Called from a worklet, the factory is serialized as a remote-function
 * stub (react-native-worklets `cloneRemoteFunction`) that throws on the UI thread: a red screen in debug,
 * but in release builds (no call guard under NDEBUG) an uncaught C++ exception and a SIGABRT. Calling
 * `tabPillConfig()` inside the dock pan's `.onFinalize` crashed iOS on every tab-bar drag release.
 *
 * The captured result is safe on the UI runtime: `Easing.bezier()` returns `{ factory }` whose factory is
 * a worklet, and neither withTiming nor withSpring mutates the config, so one memoized config can be reused.
 *
 * Reduce motion is deliberately unset: with the OS setting on, reanimated's `ReduceMotion.System` default
 * completes `withTiming` instantly and still invokes the callback, so gorhom's `onClose` fires and the
 * presence gate tears down cleanly.
 */
import { Easing, type WithTimingConfig } from "react-native-reanimated"
import { motion } from "../theme"
import type { TimingRecipe } from "../theme/motion"

export function timingConfig(r: TimingRecipe): WithTimingConfig {
  return { duration: r.duration, easing: Easing.bezier(...r.easing) }
}

export const sheetMoveConfig = (): WithTimingConfig => timingConfig(motion.sheetMove)
export const sheetDismissConfig = (): WithTimingConfig => timingConfig(motion.sheetDismiss)
export const dockMorphInConfig = (): WithTimingConfig => timingConfig(motion.dockMorphIn)
export const dockMorphOutConfig = (): WithTimingConfig => timingConfig(motion.dockMorphOut)
export const dockFocusConfig = (): WithTimingConfig => timingConfig(motion.dockFocus)
export const dockMinimizeConfig = (): WithTimingConfig => timingConfig(motion.dockMinimize)
export const tabPillConfig = (): WithTimingConfig => timingConfig(motion.tabPill)
// Two of the page-stack curves are used from a gesture callback, so PageStack.native hoists them into
// module-level consts and the pan's `.onEnd` captures the result, never the factory.
export const pagePushConfig = (): WithTimingConfig => timingConfig(motion.pagePush)
export const pagePopConfig = (): WithTimingConfig => timingConfig(motion.pagePop)
export const pageSwipeSettleConfig = (): WithTimingConfig => timingConfig(motion.pageSwipeSettle)
export const pageSwipeCancelConfig = (): WithTimingConfig => timingConfig(motion.pageSwipeCancel)
