/**
 * Guards on the shared cfPop spring. These are SOURCE assertions, not render tests: the constraints that
 * matter here (which animation library, which driver, which platform) are import- and flag-level facts
 * that a jsdom render would silently satisfy either way.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

/**
 * Comments stripped: the guards are about the CODE, and these modules' doc comments deliberately NAME the
 * things they forbid ("no reanimated"), which a raw grep would then trip over.
 */
function code(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
}

const source = code("../usePopScale.ts")
const rsvpPill = code("../RsvpPill.tsx")

describe("usePopScale", () => {
  it("uses react-native Animated, NOT reanimated", () => {
    // This hook is consumed by primitives rendering inside the gorhom sheet; reanimated is where the
    // 0.36.1 worklet-factory crash class lives, so it must stay out of this module entirely.
    expect(source).toContain('from "react-native"')
    expect(source).not.toContain("reanimated")
  })

  it("drives the spring natively, which is only safe because the value is a transform", () => {
    expect(source).toContain("useNativeDriver: true")
    expect(rsvpPill).toContain("transform: [{ scale: popScale }]")
  })

  it("stays native-only and honours OS reduce-motion", () => {
    expect(source).toContain('Platform.OS !== "web"')
    expect(source).toContain("AccessibilityInfo.isReduceMotionEnabled()")
    expect(source).toContain("reduceMotionChanged")
  })

  it("pops on the false -> true confirmation only, from the motion.pop tokens", () => {
    expect(source).toContain(
      "if (!POP_ENABLED || !active || wasActive || reduceMotionRef.current) return",
    )
    expect(source).toContain("motion.pop.from")
    expect(source).toContain("motion.pop.to")
  })
})

describe("RsvpPill", () => {
  it("consumes the shared hook rather than carrying its own copy of the spring", () => {
    expect(rsvpPill).toContain("usePopScale(going)")
    expect(rsvpPill).not.toContain("Animated.spring")
  })
})
