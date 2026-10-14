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
    ["useEntranceTransition.native.ts", "[direction, opacity, transitionKey, translateX]"],
    ["StepTransition.web.tsx", "[direction, transitionKey]"],
  ])("%s", (file, deps) => {
    const effect = layoutEffectWriting(read(file), "prevKeyRef.current = transitionKey")
    expect(effect.deps).toBe(deps)
    expect(effect.body.trim().startsWith("if (transitionKey === prevKeyRef.current) return")).toBe(true)
  })

  it.each(["BodyTransition.native.tsx", "StepTransition.native.tsx"])("%s runs the shared entrance hook", (file) => {
    expect(read(file)).toContain("useEntranceTransition(transitionKey, direction)")
    expect(read(file)).not.toContain("useLayoutEffect")
  })

  it("the native entrance publishes reduce-motion to its transition from a layout effect, not render", () => {
    expectWrittenInLayoutEffect(read("useEntranceTransition.native.ts"), "reduceMotionRef.current = reduceMotion")
  })
})

describe("useFlipPhase arms its flip and fallback once per navigation", () => {
  const source = read("useFlipPhase.ts")

  it("writes its handlers after commit, never during render", () => {
    expectWrittenInLayoutEffect(source, "handlersRef.current = { reflow, flip, settle }")
  })

  it("flips from an effect keyed on the unflipped phase only", () => {
    const flip = layoutEffectWriting(source, "handlersRef.current.flip(pendingNav)")
    expect(flip.deps).toBe("[pendingNav]")
    expect(flip.body).not.toContain("setTimeout")
    expect(flip.body.indexOf("handlersRef.current.reflow()")).toBeLessThan(flip.body.indexOf("handlersRef.current.flip("))
  })

  it("arms the fallback from an effect keyed on the phase, which the flip does not move", () => {
    const fallback = layoutEffectWriting(source, "setTimeout(() => handlersRef.current.settle(phaseNav)")
    expect(fallback.deps).toBe("[fallbackMs, phaseNav]")
    expect(fallback.body).toContain("return () => clearTimeout(fallback)")
    expect(fallback.body).not.toContain("flip")
  })
})

describe("every web transition seam keys its flip on the unflipped phase and its timers on the phase", () => {
  it.each([
    [
      "BodyTransition.web.tsx",
      "pendingNav: anim && !anim.flipped ? state.nav : null,",
      "const phaseNav = anim ? state.nav : null",
    ],
    [
      "PageStack.web.tsx",
      "pendingNav: phase && !phase.flipped ? phase.nav : null,",
      "phaseNav: phase ? phase.nav : null,",
    ],
    [
      "StepTransition.web.tsx",
      "pendingNav: entrance && !entrance.flipped ? entrance.nav : null,",
      "phaseNav: entrance ? entrance.nav : null,",
    ],
  ])("%s", (file, pending, phase) => {
    const source = read(file)
    expect(source).toContain("useFlipPhase({")
    expect(source).toContain(pending)
    expect(source).toContain(phase)
  })

  it("BodyTransition.web drops the outgoing layer from an effect keyed on the phase", () => {
    const outDrop = layoutEffectWriting(read("BodyTransition.web.tsx"), "outDropped: true")
    expect(outDrop.deps).toBe("[phaseNav]")
    expect(outDrop.body).toContain("return () => clearTimeout(outDrop)")
  })

  it("PageStack.web reflows its host only and falls back after the plan's duration plus slack", () => {
    const source = read("PageStack.web.tsx")
    expect(source).toContain("reflow: () => forceReflow([hostRef.current], false),")
    expect(source).toContain("fallbackMs: phase ? pagePlanDuration(phase.plan) + SETTLE_SLACK_MS : 0,")
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
    "useEntranceTransition.native.ts",
    "PageStack.native.tsx",
    "TabBar.native.tsx",
  ])("%s reads the shared hook, which answers a failed probe with motion on", (file) => {
    const source = read(file)
    expect(source).toContain("const reduceMotion = useReducedMotion() === true")
    expect(source).not.toContain("AccessibilityInfo.isReduceMotionEnabled()")
  })

  it("../primitives/usePopScale.ts reads the shared hook, which answers a failed probe with motion on", () => {
    expect(read("../primitives/usePopScale.ts")).toContain("const reduceMotion = useReducedMotion() === true")
    expect(read("../theme/useReducedMotion.ts")).toContain(".catch(() => setReducedMotion(false))")
  })
})
