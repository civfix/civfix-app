/**
 * Source guards for the shell's transition and keyboard effects. Each effect lists every value it reads,
 * yet still runs its body only when its trigger moves: a transition key, a navigation, a phase or the
 * keyboard ownership flag. Nothing here renders; the package has no React Native renderer.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  expectWrittenInLayoutEffect,
  layoutEffectBodies,
  sliceBetween,
  type LayoutEffectSource,
} from "../../__tests__/sourceGuards"

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8")

function layoutEffectWriting(source: string, marker: string): LayoutEffectSource {
  const matches = layoutEffectBodies(source).filter((effect) => effect.body.includes(marker))
  expect(matches, `exactly one useLayoutEffect contains ${marker}`).toHaveLength(1)
  return matches[0]!
}

describe("key-guarded transitions list what they read and still animate once per key", () => {
  it.each([
    ["BodyTransition.native.tsx", "[direction, opacity, transitionKey, translateX]"],
    ["StepTransition.native.tsx", "[direction, opacity, transitionKey, translateX]"],
    ["StepTransition.web.tsx", "[direction, transitionKey]"],
  ])("%s", (file, deps) => {
    const effect = layoutEffectWriting(read(file), "prevKeyRef.current = transitionKey")
    expect(effect.deps).toBe(deps)
    expect(effect.body.trim().startsWith("if (transitionKey === prevKeyRef.current) return")).toBe(true)
  })

  it("StepTransition.native publishes reduce-motion to its transition from a layout effect, not render", () => {
    expectWrittenInLayoutEffect(read("StepTransition.native.tsx"), "reduceMotionRef.current = reduceMotion")
  })
})

describe("BodyTransition.web arms its flip and timers once per navigation", () => {
  const effect = layoutEffectWriting(read("BodyTransition.web.tsx"), "armedNavRef.current = state.nav")

  it("lists what it reads", () => {
    expect(effect.deps).toBe("[activeSlot, anim, state.nav]")
  })

  it("returns before touching the timers when the flip or settle re-renders the same navigation", () => {
    const guarded = sliceBetween(
      effect.body,
      "if (state.nav === armedNavRef.current) return",
      "clearTimer(fallbackRef)",
    )
    expect(guarded).toContain("armedNavRef.current = state.nav")
  })
})

describe("PageStack.web keeps the settle fallback alive through the flip", () => {
  const source = read("PageStack.web.tsx")

  it("flips from an effect keyed on the unflipped phase only", () => {
    expect(source).toContain("const flipNav = phase && !phase.flipped ? phase.nav : null")
    const flip = layoutEffectWriting(source, "flipped: true")
    expect(flip.deps).toBe("[flipNav]")
    expect(flip.body).not.toContain("setTimeout")
  })

  it("arms the fallback from an effect keyed on the phase, which the flip does not move", () => {
    const fallback = layoutEffectWriting(source, "setTimeout(() => settle(phaseNav)")
    expect(fallback.deps).toBe("[phaseDuration, phaseNav, settle]")
    expect(fallback.body).toContain("return () => clearTimeout(fallback)")
    expect(fallback.body).not.toContain("flipped")
  })
})

describe("PageStack.native animates and snapshots only when the layer keys change", () => {
  const effect = layoutEffectWriting(read("PageStack.native.tsx"), "prevEntriesRef.current = entries")

  it("lists what it reads", () => {
    expect(effect.deps).toBe(
      "[dragging, dropLeaving, entries, exit, fade, front, layerKeys, reduceMotion, stack]",
    )
  })

  it("moves the leaving-layer snapshot only after the same-keys guard", () => {
    const afterGuard = sliceBetween(
      effect.body,
      "if (prevKeys.length === layerKeys.length && prevKeys.every((key, i) => key === layerKeys[i])) return",
      "const direction =",
    )
    for (const write of [
      "prevKeysRef.current = layerKeys",
      "prevEntriesRef.current = entries",
      "prevStackRef.current = stack",
    ]) {
      expect(afterGuard, write).toContain(write)
    }
  })
})

describe("KeyboardAwareScroll.native reveals on its four triggers only", () => {
  it("reads the reveal predicate from render and keys the effect on the fields it depends on", () => {
    const source = read("KeyboardAwareScroll.native.tsx")
    expect(source).toContain("const reveals = scrollKeyboardReveals(state)")
    expect(source).toContain(
      "}, [reveals, state.focusedScope, state.overlap, state.reserve, state.revealVersion])",
    )
  })
})

describe("useKeyboardAnchor.native keeps one stable apply", () => {
  const source = read("useKeyboardAnchor.native.ts")

  it.each([
    "winRef.current = windowH",
    "systemBarRef.current = systemBarInset",
    "restOffsetRef.current = restOffset",
    "gapRef.current = gap",
  ])("writes %s after commit, never during render", (assignment) => {
    expectWrittenInLayoutEffect(source, assignment)
  })

  it("reserves with the committed rest offset and gap, so apply never goes stale", () => {
    const apply = sliceBetween(source, "const apply = useCallback(", "}, [overlap, owned])")
    expect(apply).toContain("keyboardLift(cmd.reserveOverlap, restOffsetRef.current, gapRef.current)")
  })

  it("re-runs the ownership effect for `enabled` alone, since apply and measuredOverlap are stable", () => {
    const ownership = sliceBetween(source, "enabledRef.current = enabled", "const lift = useDerivedValue")
    expect(ownership).toContain("}, [apply, enabled, enabledSv, measuredOverlap])")
    expect(source).toContain("}, [apply, measuredOverlap])")
  })
})

describe("a failed reduce-motion probe is a documented choice, not a swallowed error", () => {
  it.each([
    "BodyTransition.native.tsx",
    "PageStack.native.tsx",
    "TabBar.native.tsx",
  ])("%s", (file) => {
    const probe = sliceBetween(read(file), "AccessibilityInfo.isReduceMotionEnabled()", "addEventListener(")
    expect(probe).toMatch(
      /\/\/ A failed probe keeps [^\n]*reduceMotionChanged listener[^\n]*\n\s*\.catch\(\(\) => \{\}\)/,
    )
  })

  it("../primitives/usePopScale.ts reads the shared hook, which answers a failed probe with motion on", () => {
    expect(read("../primitives/usePopScale.ts")).toContain("const reduceMotion = useReducedMotion() === true")
    expect(read("../theme/useReducedMotion.ts")).toContain(".catch(() => setReducedMotion(false))")
  })
})
