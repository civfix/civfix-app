// JS-thread only, like every factory built on it (shell/motionConfigs.native.ts records why): call it in
// render, useMemo or module scope and capture the result, never inside a worklet.
import { Easing, type WithTimingConfig } from "react-native-reanimated"
import type { TimingRecipe } from "./motion"

export function timingConfig(r: TimingRecipe): WithTimingConfig {
  return { duration: r.duration, easing: Easing.bezier(...r.easing) }
}
