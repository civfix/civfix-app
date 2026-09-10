/**
 * Reanimated adapters for the shared motion vocabulary.
 *
 * Every factory returns a FRESH object literal. Rationale (CORRECTED — the original claim that
 * gorhom always mutates the config was wrong): gorhom's animate() writes `configs.reduceMotion` ONLY
 * when `overrideReduceMotion` is truthy, and animate() is a worklet so any write would land on the
 * UI-runtime copy. Fresh objects are cheap insurance that the frozen theme token can never be reached.
 *
 * VERIFIED against BOTH installed trees (mobile reanimated 4.1.7, packages/ui 4.4.1 — identical on
 * this surface) and gorhom 5.2.14:
 *  - gorhom detects TIMING vs SPRING with `'duration' in configs || 'easing' in configs`. A reanimated
 *    DURATION-spring ({duration, dampingRatio}) is therefore MISREAD as a timing — any spring handed to
 *    gorhom MUST use the mass/stiffness/damping form.
 *  - `velocity` reaches only withSpring, never withTiming (see the sheet fling risk note).
 *  - withTiming accepts an EasingFunctionFactory and calls .factory() on start, so Easing.bezier() is legal.
 *  - reanimated 4 stops springs on a relative `energyThreshold` only.
 *
 * THREAD AFFINITY — THE RULE: **every factory in this module is JS-THREAD ONLY.** Call them in render,
 * useMemo or useEffect and CAPTURE the returned object; NEVER call one from inside a worklet (a
 * Gesture callback, useAnimatedStyle, useDerivedValue, useAnimatedReaction, useAnimatedScrollHandler).
 * None of them is a worklet and none CAN be: they are expression-bodied arrows over `timingConfig`,
 * which reaches through the whole `theme` object — adding the directive would drag every design token
 * into the closure of each calling worklet, on every gesture rebuild.
 *
 * WHY IT MATTERS, precisely: the Babel plugin captures the free identifier into the worklet's
 * `__closure`; react-native-worklets sees a function with no `__workletHash` and serializes it via
 * `cloneRemoteFunction` (serializable.ts:183); the UI runtime unpacks category "RemoteFunction" into a
 * stub whose only body is `throw new Error("[Worklets] Tried to synchronously call a non-worklet
 * function ... on the UI thread")` (valueUnpacker.ts). Debug builds turn that into an RN fatal. RELEASE
 * builds have NO guard — `runOnRuntimeGuarded` compiles `getCallGuard` only `#ifndef NDEBUG`
 * (Serializable.h:23-37) — so the jsi::JSError escapes native gesture dispatch as an uncaught C++
 * exception → std::terminate → SIGABRT. It is a silent-in-dev, hard-kill-in-TestFlight crash, not a
 * dropped frame. This is not hypothetical: `withTiming(lockedX, tabPillConfig())` inside the dock pan's
 * `.onFinalize` crashed iOS on EVERY drag-release of the tab bar until it was hoisted.
 *
 * The captured RESULT is perfectly safe on the UI runtime, which is what makes the hoist the correct
 * fix rather than a dodge: `Easing.bezier()` returns `{ factory }` whose factory IS a worklet, so a
 * timing config serializes as a plain object plus a cloned worklet, with nothing remote in it. And
 * neither withTiming nor withSpring mutates the config you hand them (they copy your keys into their
 * own internal object), so a single memoized config is safe to reuse across many animations.
 *
 * REDUCE MOTION: deliberately not set here. reanimated's default is `ReduceMotion.System`; with OS
 * reduce-motion on, `withTiming` completes instantly AND still invokes the completion callback, so
 * gorhom's `onClose` fires immediately and the presence gate tears down cleanly.
 */
import { Easing, type WithTimingConfig } from "react-native-reanimated"
import { theme } from "../theme"
import type { TimingRecipe } from "../theme/motion"

export function timingConfig(r: TimingRecipe): WithTimingConfig {
  return { duration: r.duration, easing: Easing.bezier(...r.easing) }
}

export const sheetMoveConfig = (): WithTimingConfig => timingConfig(theme.motion.sheetMove)
export const sheetDismissConfig = (): WithTimingConfig => timingConfig(theme.motion.sheetDismiss)
export const dockMorphInConfig = (): WithTimingConfig => timingConfig(theme.motion.dockMorphIn)
export const dockMorphOutConfig = (): WithTimingConfig => timingConfig(theme.motion.dockMorphOut)
export const dockFocusConfig = (): WithTimingConfig => timingConfig(theme.motion.dockFocus)
export const dockMinimizeConfig = (): WithTimingConfig => timingConfig(theme.motion.dockMinimize)
export const tabPillConfig = (): WithTimingConfig => timingConfig(theme.motion.tabPill)
// The native PAGE STACK's four curves (shell/PageStack.native). Two of them are reached from a GESTURE
// callback, which is precisely the position THE RULE above is about: PageStack hoists all four into
// module-level consts at import time and the pan's `.onEnd` captures the RESULT, never the factory.
export const pagePushConfig = (): WithTimingConfig => timingConfig(theme.motion.pagePush)
export const pagePopConfig = (): WithTimingConfig => timingConfig(theme.motion.pagePop)
export const pageSwipeSettleConfig = (): WithTimingConfig => timingConfig(theme.motion.pageSwipeSettle)
export const pageSwipeCancelConfig = (): WithTimingConfig => timingConfig(theme.motion.pageSwipeCancel)
