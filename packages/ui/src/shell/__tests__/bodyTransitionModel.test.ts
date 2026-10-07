import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { MOTION } from "../../theme/motion"
import { bodyTransitionPlan, translateRatio, type BodyTransitionTiming } from "../bodyTransitionModel"

const TIMING: BodyTransitionTiming = {
  slideDuration: 240,
  fadeDuration: 160,
  exitDuration: 160,
  travelRatio: 0.28,
  underRatio: 0.15,
  fadeRatio: 0.6,
}

describe("bodyTransitionPlan - motion enabled", () => {
  it("pushes the incoming body in from the right and recedes the outgoing one to the left", () => {
    expect(bodyTransitionPlan("push", false, TIMING)).toEqual({
      fromRatio: 0.28,
      exitRatio: -0.15,
      slide: true,
      duration: 240,
      fadeDuration: 144,
      exitDuration: 160,
    })
  })

  it("pops the EXACT reverse: incoming from the receded left, outgoing back out to the right", () => {
    const push = bodyTransitionPlan("push", false, TIMING)
    const pop = bodyTransitionPlan("pop", false, TIMING)
    expect(pop.fromRatio).toBe(push.exitRatio)
    expect(pop.exitRatio).toBe(push.fromRatio)
    expect(pop.slide).toBe(true)
    expect(pop.duration).toBe(push.duration)
  })

  it("travels the incoming page further than the outgoing one recedes", () => {
    const push = bodyTransitionPlan("push", false, TIMING)
    expect(push.fromRatio).toBeGreaterThan(Math.abs(push.exitRatio))
  })

  it("replace is a pure crossfade: no slide, no travel, at the fade duration", () => {
    expect(bodyTransitionPlan("replace", false, TIMING)).toEqual({
      fromRatio: 0,
      exitRatio: 0,
      slide: false,
      duration: 160,
      fadeDuration: 160,
      exitDuration: 160,
    })
  })
})

describe("bodyTransitionPlan - reduce motion", () => {
  it("keeps the fade but drops every positional channel, in both directions", () => {
    for (const direction of ["push", "pop"] as const) {
      const plan = bodyTransitionPlan(direction, true, TIMING)
      expect(plan.slide, direction).toBe(false)
      expect(plan.fromRatio, direction).toBe(0)
      expect(plan.exitRatio, direction).toBe(0)
      expect(plan.duration, direction).toBe(TIMING.fadeDuration)
    }
  })

  it("replace is unchanged by reduce-motion (already a pure fade)", () => {
    expect(bodyTransitionPlan("replace", true, TIMING)).toEqual(
      bodyTransitionPlan("replace", false, TIMING),
    )
  })
})

describe("bodyTransitionPlan - the travel is a FRACTION of the host, not a fixed nudge", () => {
  it("scales the offsets with the injected ratios", () => {
    const wide: BodyTransitionTiming = { ...TIMING, travelRatio: 0.5, underRatio: 0.25 }
    expect(bodyTransitionPlan("push", false, wide).fromRatio).toBe(0.5)
    expect(bodyTransitionPlan("push", false, wide).exitRatio).toBe(-0.25)
    expect(bodyTransitionPlan("pop", false, wide).fromRatio).toBe(-0.25)
  })

  it("renders a ratio as a percentage translate, so a layer travels a share of its own width", () => {
    expect(translateRatio(0)).toBe("translateX(0%)")
    expect(translateRatio(0.28)).toBe("translateX(28%)")
    expect(translateRatio(-0.15)).toBe("translateX(-15%)")
  })
})

describe("bodyTransitionPlan - the opacity channel LEADS the slide", () => {
  it("push and pop fade for less than they slide", () => {
    for (const direction of ["push", "pop"] as const) {
      const plan = bodyTransitionPlan(direction, false, TIMING)
      expect(plan.fadeDuration).toBeLessThan(plan.duration)
    }
  })

  it("a fade-only swap has nothing to lead, so the two are equal", () => {
    const replace = bodyTransitionPlan("replace", false, TIMING)
    expect(replace.fadeDuration).toBe(replace.duration)
    const reduced = bodyTransitionPlan("push", true, TIMING)
    expect(reduced.fadeDuration).toBe(reduced.duration)
  })
})

describe("BODY_TIMING - one vocabulary for every seam", () => {
  const timing = readFileSync(new URL("../bodyTransitionTiming.ts", import.meta.url), "utf8")

  it("resolves every number from the motion tokens, never from a literal", () => {
    expect(timing).toMatch(/slideDuration: motion\.bodyPush\.duration/)
    expect(timing).toMatch(/fadeDuration: motion\.bodyReplace\.duration/)
    expect(timing).toMatch(/exitDuration: motion\.bodyExit\.duration/)
    expect(timing).toMatch(/fadeRatio: motion\.bodyFadeRatio/)
    expect(timing).not.toMatch(/: \d/)
  })

  it("shares the PAGE stack's geometry, so a body swap and a page push read as one language", () => {
    expect(timing).toMatch(/travelRatio: motion\.pageTravelRatio/)
    expect(timing).toMatch(/underRatio: motion\.pageParallaxRatio/)
    expect(MOTION.pageTravelRatio).toBeGreaterThan(MOTION.pageParallaxRatio)
  })
})

describe("the body-transition seams honour the plan", () => {
  const native = readFileSync(new URL("../useEntranceTransition.native.ts", import.meta.url), "utf8")
  const web = readFileSync(new URL("../BodyTransition.web.tsx", import.meta.url), "utf8")
  const bodyNative = readFileSync(new URL("../BodyTransition.native.tsx", import.meta.url), "utf8")
  const stepNative = readFileSync(new URL("../StepTransition.native.tsx", import.meta.url), "utf8")
  const stepWeb = readFileSync(new URL("../StepTransition.web.tsx", import.meta.url), "utf8")

  it("runs body and step swaps on native through the one entrance hook", () => {
    for (const [name, src] of [
      ["body.native", bodyNative],
      ["step.native", stepNative],
    ] as const) {
      expect(src, name).toContain("const { onLayout, animatedStyle } = useEntranceTransition(transitionKey, direction)")
      expect(src, name).toMatch(/<Animated\.View onLayout=\{onLayout\} style=\{\[[\w.]+, animatedStyle\]\}>/)
    }
  })

  it("takes every duration and distance from BODY_TIMING - no seam-local literals", () => {
    for (const [name, src] of [
      ["native", native],
      ["web", web],
      ["step.web", stepWeb],
    ] as const) {
      expect(src, name).toContain("BODY_TIMING")
      expect(src, name).toMatch(/bodyTransitionPlan\(/)
      expect(src, name).not.toMatch(/duration: \d+/)
    }
  })

  it("turns the plan's ratio into a real distance: measured width on native, a percentage on web", () => {
    expect(native).toMatch(/translateX\.setValue\(plan\.fromRatio \* widthRef\.current\)/)
    expect(native).toMatch(/widthRef\.current = e\.nativeEvent\.layout\.width/)
    expect(web).toMatch(/translateRatio\(plan\.fromRatio\)/)
    expect(web).toMatch(/translateRatio\(plan\.exitRatio\)/)
    expect(stepWeb).toMatch(/translateRatio\(flipped \? 0 : plan\.fromRatio\)/)
  })

  it("is DIRECTION-aware in every seam: the plan is built from the incoming `direction`", () => {
    expect(native).toMatch(/bodyTransitionPlan\(direction, reduceMotionRef\.current, BODY_TIMING\)/)
    expect(web).toMatch(/bodyTransitionPlan\(direction, false, BODY_TIMING\)/)
    expect(stepWeb).toMatch(/bodyTransitionPlan\(direction, false, BODY_TIMING\)/)
  })

  it("short-circuits on the platform's reduce-motion signal before any slide is scheduled", () => {
    expect(native).toMatch(/useReducedMotion\(\) === true/)
    expect(web).toMatch(/const instant = prefersReducedMotion\(\)/)
    expect(web).toMatch(/anim: instant\s*\?\s*null/)
    expect(stepWeb).toMatch(/if \(prefersReducedMotion\(\)\) \{/)
  })

  it("slides the OUTGOING web layer too - the parallax that makes a push read as depth", () => {
    expect(web).toMatch(/outgoingTo: \{ transform: translateRatio\(plan\.exitRatio\), opacity: 0 \}/)
    expect(web).toMatch(/\["transform", plan\.exitDuration\]/)
  })
})
