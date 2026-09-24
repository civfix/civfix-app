/**
 * useKeyboardAnchor (native seam): the canonical keyboard primitive.
 *  1. Ownership: a surface only rises for a keyboard it raised, enforced on the UI thread (`enabledSv`).
 *  2. Timebase: reanimated's iOS notification path estimates progress against a hard-coded 0.48s /
 *     0.496s; re-parameterising its fitted curves onto the OS-reported duration removes the trail-then-snap.
 *  3. Rest offset: the surface lands exactly `gap` above the keyboard top.
 *
 * `lift` is per-frame on the UI thread and `reserved` is per-transition on the JS thread (see
 * useKeyboardAnchor.types.ts); never conflate them.
 */
import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react"
import {
  Keyboard,
  Platform,
  useWindowDimensions,
  type KeyboardEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import { isEdgeToEdge } from "react-native-is-edge-to-edge"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"
import {
  ReduceMotion,
  useAnimatedKeyboard,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated"
import { motion } from "../theme"
import {
  KEYBOARD_SURFACE_GAP,
  iosKeyboardCloseEasing,
  iosKeyboardOpenEasing,
  isRedundantClose,
  keyboardAnimationDuration,
  keyboardLift,
  keyboardMirrorOverlap,
  keyboardViewportOverlap,
  reduceKeyboard,
  type KeyboardCommand,
  type KeyboardPhase,
} from "./keyboardInsetModel"
import type { KeyboardAnchor, KeyboardAnchorOptions } from "./useKeyboardAnchor.types"
import { useRestingWindowHeight } from "./useRestingWindowHeight"

const PLATFORM: "ios" | "android" | "other" =
  Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "other"

const EDGE_TO_EDGE = isEdgeToEdge()

export function useKeyboardAnchor({
  enabled = true,
  restOffset = 0,
  gap = KEYBOARD_SURFACE_GAP,
}: KeyboardAnchorOptions = {}): KeyboardAnchor {
  const kb = useAnimatedKeyboard()
  const windowH = useWindowDimensions().height
  const restingWindowHeight = useRestingWindowHeight()
  const safeAreaBottom = useContext(SafeAreaInsetsContext)?.bottom ?? 0
  const systemBarInset = PLATFORM === "android" ? safeAreaBottom : 0

  const overlap = useSharedValue(0)
  const owned = useSharedValue(0)
  /** Without this UI-thread gate the continuous mirror re-publishes a foreign keyboard's live height the
   *  instant `owned` clears, and the dock rides up for every TextField in the app. The pure reducer cannot
   *  express it. */
  const enabledSv = useSharedValue(enabled ? 1 : 0)
  const systemBarSv = useSharedValue(systemBarInset)
  const restSv = useSharedValue(restOffset)
  const gapSv = useSharedValue(gap)
  useEffect(() => {
    systemBarSv.value = systemBarInset
  }, [systemBarInset, systemBarSv])
  useEffect(() => {
    restSv.value = restOffset
  }, [restOffset, restSv])
  useEffect(() => {
    gapSv.value = gap
  }, [gap, gapSv])

  const phase = useRef<KeyboardPhase>("idle")
  const enabledRef = useRef(enabled)
  const winRef = useRef(windowH)
  const systemBarRef = useRef(systemBarInset)
  const restOffsetRef = useRef(restOffset)
  const gapRef = useRef(gap)
  // Keyboard events arrive between renders, so they read the last committed geometry through refs,
  // which also keeps `apply` and the listeners stable across layout changes.
  useLayoutEffect(() => {
    winRef.current = windowH
    systemBarRef.current = systemBarInset
    restOffsetRef.current = restOffset
    gapRef.current = gap
  })

  const measuredOverlap = useCallback(
    (endCoordinates: { screenY?: number; height?: number } | undefined) =>
      keyboardViewportOverlap({
        endCoordinates,
        windowHeight: winRef.current,
        restingWindowHeight: restingWindowHeight.current,
        platform: PLATFORM,
        systemBarInset: systemBarRef.current,
      }),
    [restingWindowHeight],
  )

  /** An overlap, not a lift: replayed into `will-hide` so the reservation holds through the close. */
  const reserveOverlapRef = useRef(0)
  /** One record for two jobs, so they can never disagree: the `closing` flag that carries the
   *  reservation through the blur, and the dedupe key that stops that blur restarting the close. */
  const inFlightCloseRef = useRef<number | null>(null)
  /** iOS can deliver keyboardWillShow before React commits `focused: true`. */
  const lastWillShow = useRef<{ overlap: number; duration: number; at: number } | null>(null)
  const [engaged, setEngaged] = useState(false)
  const [reserved, setReserved] = useState(0)

  // reanimated's height is the genuine per-frame value on Android (WindowInsetsAnimationCompat) and
  // during an iOS interactive dismissal; only the iOS notification path is an estimate, and `owned` masks
  // that. `enabledSv` masks a keyboard we do not own on both platforms.
  useAnimatedReaction(
    () => kb.height.value,
    (h) => {
      if (enabledSv.value === 0) {
        // Losing ownership with the keyboard up starts an animated withTiming(0) release with owned = 1.
        // A plain shared-value assignment cancels a running animation and this fires every frame, so an
        // unconditional reset would snap the surface down behind the still-descending keyboard.
        if (owned.value === 0) overlap.value = 0
        return
      }
      if (owned.value === 0)
        overlap.value = keyboardMirrorOverlap({
          reanimatedHeight: h,
          systemBarInset: systemBarSv.value,
          edgeToEdge: EDGE_TO_EDGE,
        })
    },
  )

  const apply = useCallback((cmd: KeyboardCommand, closing: boolean) => {
    phase.current = cmd.phase
    setEngaged(cmd.phase === "engaged")
    reserveOverlapRef.current = cmd.reserveOverlap
    setReserved(keyboardLift(cmd.reserveOverlap, restOffsetRef.current, gapRef.current))
    // The phase and reservation above still apply; only the animation is dropped, because reanimated
    // would restart the ease-out and re-accelerate the dock while the keyboard is still decelerating.
    if (isRedundantClose(cmd, inFlightCloseRef.current)) return
    if (cmd.duration <= 0) {
      inFlightCloseRef.current = null
      owned.value = 0
      overlap.value = cmd.target
      return
    }
    inFlightCloseRef.current = closing ? cmd.target : null
    owned.value = 1
    overlap.value = withTiming(cmd.target, {
      duration: cmd.duration,
      easing: closing ? iosKeyboardCloseEasing : iosKeyboardOpenEasing,
      reduceMotion: ReduceMotion.System,
    })
  }, [overlap, owned])

  // Android is not registered for will*: its duration is documented as always 0 and its insets
  // animation is already frame-exact through the mirror above.
  useEffect(() => {
    const subs: { remove(): void }[] = []
    const dur = (e: KeyboardEvent) =>
      keyboardAnimationDuration(e.duration, motion.keyboardFallbackMs, motion.keyboardMaxMs)
    if (Platform.OS === "ios") {
      subs.push(
        Keyboard.addListener("keyboardWillShow", (e: KeyboardEvent) => {
          const overlapPt = measuredOverlap(e.endCoordinates)
          lastWillShow.current = { overlap: overlapPt, duration: dur(e), at: Date.now() }
          apply(
            reduceKeyboard(phase.current, {
              type: "will-show",
              overlap: overlapPt,
              duration: dur(e),
              enabled: enabledRef.current,
            }),
            false,
          )
        }),
      )
      subs.push(
        Keyboard.addListener("keyboardWillHide", (e: KeyboardEvent) => {
          lastWillShow.current = null
          apply(
            reduceKeyboard(phase.current, {
              type: "will-hide",
              duration: dur(e),
              reserveHint: reserveOverlapRef.current,
            }),
            true,
          )
        }),
      )
    }
    subs.push(
      Keyboard.addListener("keyboardDidShow", (e: KeyboardEvent) => {
        apply(
          reduceKeyboard(phase.current, {
            type: "did-settle",
            overlap: measuredOverlap(e.endCoordinates),
            enabled: enabledRef.current,
          }),
          false,
        )
      }),
    )
    subs.push(
      Keyboard.addListener("keyboardDidHide", () => {
        lastWillShow.current = null
        apply(
          reduceKeyboard(phase.current, { type: "did-settle", overlap: 0, enabled: enabledRef.current }),
          true,
        )
      }),
    )
    return () => subs.forEach((s) => s.remove())
  }, [apply, measuredOverlap])

  // An in-flight willShow is replayed because `Keyboard.metrics()` is undefined for the whole show
  // animation (RN assigns it only in keyboardDidShow): without the replay, focusing after a willShow moves
  // nothing until didShow and then teleports the surface in one frame.
  useEffect(() => {
    enabledRef.current = enabled
    enabledSv.value = enabled ? 1 : 0
    const pending = lastWillShow.current
    if (enabled && pending && Date.now() - pending.at < motion.keyboardMaxMs) {
      apply(
        reduceKeyboard(phase.current, {
          type: "will-show",
          overlap: pending.overlap,
          duration: pending.duration,
          enabled: true,
        }),
        false,
      )
      return
    }
    const live = measuredOverlap(Keyboard.metrics())
    apply(
      reduceKeyboard(phase.current, {
        type: "ownership",
        enabled,
        liveOverlap: live,
        handoffMs: motion.keyboardHandoffMs,
        // iOS posts keyboardWillHide, which sets this ref, before the field's blur re-runs this effect.
        closing: inFlightCloseRef.current !== null,
        reserveHint: reserveOverlapRef.current,
      }),
      !enabled,
    )
  }, [apply, enabled, enabledSv, measuredOverlap])

  const lift = useDerivedValue(() => keyboardLift(overlap.value, restSv.value, gapSv.value))
  const liftStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -lift.value }] }))
  // Widened to the cross-platform contract: `liftStyle` must go to an Animated.View (or
  // <KeyboardAnchorView>), never a plain View, and `lift` is read-only in practice.
  return {
    liftStyle: liftStyle as unknown as StyleProp<ViewStyle>,
    lift: lift as unknown as SharedValue<number>,
    reserved,
    engaged,
  }
}
