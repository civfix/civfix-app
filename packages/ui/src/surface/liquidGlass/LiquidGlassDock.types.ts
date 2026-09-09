/**
 * Shared props contract for the LiquidGlassDock platform seams (.native = expo-blur + Skia liquid
 * material; default/.tsx = web/tooling BlurSurface equivalent). Type-only reanimated import so the
 * web seam stays free of native runtime code.
 */
import type React from "react"
import type { StyleProp, ViewStyle } from "react-native"
// The lint ban on reanimated outside *.native.* seams guards the RUNTIME web bundle; this is a
// type-ONLY import (fully erased by tsc/bundlers), so the web seam still ships zero reanimated code
// while call sites keep the exact `SharedValue<number>` contract.
// eslint-disable-next-line no-restricted-imports
import type { DerivedValue, SharedValue } from "react-native-reanimated"
import type { DockShapes } from "./liquidGlassModel"

export interface LiquidGlassDockProps {
  /**
   * The dock region's measured LOCAL width (pt) - the track the two shapes span (outer margin already
   * applied by the host). The mirrored width-swap geometry (dockShapes) is derived from this + progress.
   */
  regionW: number
  /**
   * Morph progress 0..1 (reanimated shared value): 0 = wide tab capsule + detached search orb,
   * 1 = exit circle + wide search field. Drive with withSpring for the liquid feel.
   */
  progress: SharedValue<number>
  /**
   * Focus collapse 0..1 (reanimated shared value): 0 = the docked [exit circle | field] pair, 1 = ONE
   * full-width field (the right shape widens to the whole region, covering the left circle) for the
   * Apple-Music field-only focus rise. Only meaningful at progress≈1; omit for the static web dock.
   */
  focus?: SharedValue<number>
  /**
   * Scroll-minimize 0..1 (reanimated shared value, Apple-Music `.onScrollDown`): 0 = the full wide tab
   * capsule, 1 = the LEFT shape collapsed to an H glyph circle at the leading margin (the detached search
   * orb is untouched). Only meaningful at progress≈0 (the search morph already collapses the left shape);
   * omit for the static web dock. Callers keep it 0 during Search.
   */
  minimize?: SharedValue<number>
  /**
   * The already-solved dock geometry for this frame. OPTIONAL, and purely an optimisation: a host that
   * ALSO needs the shapes (the native TabBar positions its glyphs, magnifier, field and ✕ off them) solves
   * `dockShapes(progress, regionW, focus, minimize)` once in a `useDerivedValue` and passes it here, so the
   * dock reads that instead of re-deriving the identical result. Omit it and the dock derives its own from
   * `regionW`/`progress`/`focus`/`minimize` exactly as before.
   *
   * MUST be derived from the SAME inputs this dock was given — the dock does not validate that.
   */
  shapes?: DerivedValue<DockShapes>
  /** Interactive content (tabs / search chrome) rendered ABOVE the glass; receives touches normally. */
  children?: React.ReactNode
  /** Positions/sizes the dock region within its parent. */
  style?: StyleProp<ViewStyle>
}
