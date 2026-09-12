/**
 * useKeyboardAnchor — THE canonical keyboard primitive's FROZEN public contract.
 *
 * This file is types only, so it is shared by BOTH platform seams and by shared (platform-neutral)
 * bodies. The `SharedValue` import is `import type`, erased at compile time exactly like
 * `surface/liquidGlass/LiquidGlassDock.types.ts` does — no reanimated runtime reaches the web bundle.
 *
 * FROZEN: three other workstreams (dock keyboard alignment, the reply composer, the sheet handoff)
 * code against these shapes. Changing them requires a cross-workstream decision.
 *
 * THE INVARIANT that governs every consumer: `lift` is PER-FRAME and lives on the UI thread;
 * `reserved` is PER-TRANSITION and lives on the JS thread. Never animate a layout property off
 * `reserved`; never read `lift` from JS.
 */
import type { StyleProp, ViewStyle } from "react-native"
// The lint ban on reanimated outside *.native.* seams guards the RUNTIME web bundle; this is a
// type-ONLY import (fully erased by tsc/bundlers), so the web seam still ships zero reanimated code
// while call sites keep the exact `SharedValue<number>` contract. Same exemption, same reason, as
// surface/liquidGlass/LiquidGlassDock.types.ts.
// eslint-disable-next-line no-restricted-imports
import type { SharedValue } from "react-native-reanimated"

export interface KeyboardAnchorOptions {
  /**
   * Does THIS surface own the focused input? Only an enabled surface starts a rise; a surface that
   * LOSES ownership while the keyboard stays up animates back down over MOTION.keyboardHandoffMs, and a
   * surface that GAINS ownership while a keyboard is already up adopts it over the same duration.
   * ENFORCED ON THE UI THREAD, not merely in the reducer. Default true.
   */
  enabled?: boolean
  /**
   * pt already between the surface's VISIBLE bottom edge and the window bottom AT REST (safe-area
   * padding, floating margin, container padding, dead band). The lift subtracts it so the surface lands
   * exactly `gap` above the keyboard. MUST be a plain number: it is read on BOTH threads. Default 0.
   * Known values: docked search bar native = dockKeyboardRestOffset(insets.bottom) (36 on a 34pt inset);
   * docked search bar web = theme.space["3"] + 10 = 22.
   */
  restOffset?: number
  /** Desired visual gap between the surface's VISIBLE bottom edge and the keyboard top.
   *  Default KEYBOARD_SURFACE_GAP (8). */
  gap?: number
  /**
   * WEB ONLY. True when an ANCESTOR already reserved the keyboard overlap (the full-social-modal overlay
   * in PortraitShell.shared applies `paddingBottom: keyboardInset`). Suppresses this surface's own lift
   * so the inset is never applied twice. IGNORED on native, where no ancestor reserves anything.
   * Default false.
   */
  hostReserved?: boolean
}

export interface KeyboardAnchor {
  /**
   * APPLY THIS to the element that must rise.
   *   NATIVE: a reanimated animated style — the element MUST be an Animated.View (or use
   *           <KeyboardAnchorView>, which is what SHARED files must use so they never import reanimated).
   *   WEB:    a plain style object carrying a CSS translateY + transition.
   */
  liftStyle: StyleProp<ViewStyle>
  /** UI-thread lift magnitude in pt, for consumers composing it into their OWN worklet. NULL ON WEB —
   *  do not dereference without a null check. */
  lift: SharedValue<number> | null
  /**
   * JS-thread bottom space (pt) the surface's CONTENT must reserve while the keyboard is up.
   * Changes AT MOST TWICE per keyboard transition (will-show / did-settle) — NEVER per frame. It is
   * HELD through the close animation and released only at did-settle, so content does not re-expand
   * under a still-travelling bar.
   */
  reserved: number
  /** True while this surface owns the keyboard (its input is focused, or the keyboard it raised is
   *  still animating away). Gate pointer/scroll behaviour with this — never layout. */
  engaged: boolean
}
