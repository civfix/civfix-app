/**
 * Kept free of react-native imports so both the reanimated worklets and the vitest suites can load it.
 * The `"worklet"` directives let a UI-thread worklet call these; on the JS thread they are inert strings.
 */

export function clamp01(v: number): number {
  "worklet"
  return v < 0 ? 0 : v > 1 ? 1 : v
}

export function clamp(value: number, min: number, max: number): number {
  "worklet"
  return Math.min(Math.max(value, min), max)
}
