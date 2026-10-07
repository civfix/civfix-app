/**
 * The keyboard anchor's public contract, shared by both platform seams and by platform-neutral bodies.
 * The dock, the reply composer and the sheet handoff code against these shapes, so a change needs all
 * three reviewed.
 *
 * `lift` is per-frame on the UI thread; `reserved` is per-transition on the JS thread. Never animate a
 * layout property off `reserved`, and never read `lift` from JS.
 */
import type { StyleProp, ViewStyle } from "react-native"
// eslint-disable-next-line no-restricted-imports -- type-only, erased at compile time, so no reanimated reaches the web bundle
import type { SharedValue } from "react-native-reanimated"

export interface KeyboardAnchorOptions {
  /**
   * Whether this surface owns the focused input. Gaining or losing ownership while a keyboard is up
   * animates over MOTION.keyboardHandoffMs. Enforced on the UI thread, not merely in the reducer.
   */
  enabled?: boolean
  /**
   * pt between the surface's visible bottom edge and the window bottom at rest, subtracted so the surface
   * lands exactly `gap` above the keyboard. Must be a plain number: it is read on both threads.
   */
  restOffset?: number
  gap?: number
  /**
   * Web only: an ancestor already reserved the keyboard overlap, so this surface's own lift is suppressed
   * and the inset is never applied twice. Ignored on native, where no ancestor reserves anything.
   */
  hostReserved?: boolean
}

export interface KeyboardAnchor {
  /**
   * On native a reanimated animated style, so the element must be an Animated.View; shared files use
   * <KeyboardAnchorView> so they never import reanimated. On web a plain CSS translateY + transition.
   */
  liftStyle: StyleProp<ViewStyle>
  /** Null on web. */
  lift: SharedValue<number> | null
  /**
   * Bottom space the content must reserve. Changes at most twice per keyboard transition, never per
   * frame, and is held until did-settle so content does not re-expand under a still-travelling bar.
   */
  reserved: number
  /** Also true while the keyboard this surface raised is still animating away. Never gate layout on it. */
  engaged: boolean
}
