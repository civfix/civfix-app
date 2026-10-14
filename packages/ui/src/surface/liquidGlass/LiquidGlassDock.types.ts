import type React from "react"
import type { StyleProp, ViewStyle } from "react-native"
// eslint-disable-next-line no-restricted-imports -- type-only import, erased before bundling; the ban guards the runtime web bundle
import type { DerivedValue, SharedValue } from "react-native-reanimated"
import type { DockShapes } from "./liquidGlassModel"

export interface LiquidGlassDockProps {
  /** Measured local width (pt) of the track, with the outer margin already applied by the host. */
  regionW: number
  /** 0 = tab capsule + search orb, 1 = exit circle + search field. Driven by a timing animation (MOTION.dockMorphIn/Out). */
  progress: SharedValue<number>
  /** Search focus; only meaningful at progress 1. Omit for the static web dock. */
  focus?: SharedValue<number>
  /** Scroll-down collapse of the tab capsule; only meaningful at progress 0, and kept 0 during Search. */
  minimize?: SharedValue<number>
  /**
   * Optional: a host that also positions content off the shapes solves `dockShapes` once and passes it
   * here instead of the dock re-deriving it. It must come from the same inputs; the dock does not check.
   */
  shapes?: DerivedValue<DockShapes>
  children?: React.ReactNode
  style?: StyleProp<ViewStyle>
}
