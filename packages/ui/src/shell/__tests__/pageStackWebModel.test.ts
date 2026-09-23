import { describe, expect, it } from "vitest"
import { MOTION } from "../../theme/motion"
import {
  pageLayerTokens,
  pageTransitionPlan,
  type PageMotionTokens,
  type PageTransitionTiming,
} from "../pageStackModel"
import {
  INSTANT_PAGE_PLAN,
  isInstantPagePlan,
  pagePlanDuration,
  restingLayerProgress,
  webLayerCss,
  webLayerProgress,
  webLayerTransition,
  webPageTransitionPlan,
  type WebPageTransitionContext,
} from "../pageStackWebModel"

const WIDTH = 390
const px = (value: number) => `translateX(${Math.round(value * 100) / 100}px)`
const PAGE_MOTION: PageMotionTokens = {
  travelRatio: MOTION.pageTravelRatio,
  parallaxRatio: MOTION.pageParallaxRatio,
  scrimOpacity: MOTION.pageScrimOpacity,
}
const ANIMATED = pageLayerTokens(PAGE_MOTION, false, false)
const REDUCED = pageLayerTokens(PAGE_MOTION, true, false)
const TIMING: PageTransitionTiming = {
  pushDuration: MOTION.pagePush.duration,
  popDuration: MOTION.pagePop.duration,
  fadeDuration: MOTION.bodyReplace.duration,
}
const LIVE: WebPageTransitionContext = {
  restored: false,
  reduceMotion: false,
  keyboardBound: false,
  coarsePointer: false,
}
const DIRECTIONS = ["push", "pop", "replace"] as const

describe("webPageTransitionPlan - when a web page change animates at all", () => {
  it("is instant for a history restore in every direction, so the browser's own swipe never plays twice", () => {
    for (const direction of DIRECTIONS) {
      expect(webPageTransitionPlan(direction, { ...LIVE, restored: true }, TIMING)).toBe(INSTANT_PAGE_PLAN)
    }
  })

  it("is instant for a keyboard-bound page on touch, and animates it on a fine pointer", () => {
    expect(
      webPageTransitionPlan("push", { ...LIVE, keyboardBound: true, coarsePointer: true }, TIMING),
    ).toBe(INSTANT_PAGE_PLAN)
    expect(webPageTransitionPlan("push", { ...LIVE, keyboardBound: true }, TIMING)).toEqual(
      pageTransitionPlan("push", false, TIMING),
    )
  })

  it("slides an ordinary page on touch", () => {
    expect(webPageTransitionPlan("push", { ...LIVE, coarsePointer: true }, TIMING).slide).toBe(true)
  })

  it("otherwise is exactly the native plan for every direction and motion preference", () => {
    for (const direction of DIRECTIONS) {
      for (const reduceMotion of [false, true]) {
        expect(webPageTransitionPlan(direction, { ...LIVE, reduceMotion }, TIMING)).toEqual(
          pageTransitionPlan(direction, reduceMotion, TIMING),
        )
      }
    }
  })
})

describe("isInstantPagePlan / pagePlanDuration", () => {
  it("calls a plan instant only when neither a slide nor a fade has any duration", () => {
    expect(isInstantPagePlan(INSTANT_PAGE_PLAN)).toBe(true)
    for (const direction of DIRECTIONS) {
      expect(isInstantPagePlan(pageTransitionPlan(direction, false, TIMING))).toBe(false)
      expect(isInstantPagePlan(pageTransitionPlan(direction, true, TIMING))).toBe(false)
    }
  })

  it("times a slide by its slide duration and a cross-fade by its fade duration", () => {
    expect(pagePlanDuration(pageTransitionPlan("push", false, TIMING))).toBe(MOTION.pagePush.duration)
    expect(pagePlanDuration(pageTransitionPlan("pop", false, TIMING))).toBe(MOTION.pagePop.duration)
    expect(pagePlanDuration(pageTransitionPlan("replace", false, TIMING))).toBe(
      MOTION.bodyReplace.duration,
    )
    expect(pagePlanDuration(INSTANT_PAGE_PLAN)).toBe(0)
  })
})

describe("webLayerProgress - the two poses every layer moves between", () => {
  const push = (index: number, flipped: boolean) =>
    webLayerProgress({ index, topIndex: 2, hasLeaving: false, direction: "push", flipped, slide: true })
  const pop = (index: number, flipped: boolean) =>
    webLayerProgress({ index, topIndex: 2, hasLeaving: true, direction: "pop", flipped, slide: true })
  const fade = (index: number, flipped: boolean) =>
    webLayerProgress({ index, topIndex: 2, hasLeaving: false, direction: "replace", flipped, slide: false })

  it("starts a push with the incoming page off to the right and the page beneath uncovered", () => {
    expect(push(2, false)).toEqual({ own: 1, above: 1, fade: 1 })
    expect(push(1, false)).toEqual({ own: 0, above: 1, fade: 1 })
    expect(push(0, false)).toEqual({ own: 0, above: 0, fade: 1 })
  })

  it("ends a push with the incoming page home and the page beneath covered", () => {
    expect(push(2, true)).toEqual({ own: 0, above: 1, fade: 1 })
    expect(push(1, true)).toEqual({ own: 0, above: 0, fade: 1 })
    expect(push(0, true)).toEqual({ own: 0, above: 0, fade: 1 })
  })

  it("starts a pop exactly where the stack rested, and ends with the leaving page out and its parent uncovered", () => {
    expect(pop(2, false)).toEqual({ own: 0, above: 1, fade: 1 })
    expect(pop(1, false)).toEqual({ own: 0, above: 0, fade: 1 })
    expect(pop(2, true)).toEqual({ own: 1, above: 1, fade: 1 })
    expect(pop(1, true)).toEqual({ own: 0, above: 1, fade: 1 })
    expect(pop(0, true)).toEqual({ own: 0, above: 0, fade: 1 })
  })

  it("never moves the top page on a pop that retained nothing", () => {
    const top = webLayerProgress({
      index: 1,
      topIndex: 1,
      hasLeaving: false,
      direction: "pop",
      flipped: true,
      slide: true,
    })
    expect(top.own).toBe(0)
  })

  it("cross-fades only the top page when there is no slide", () => {
    expect(fade(2, false).fade).toBe(0)
    expect(fade(2, true).fade).toBe(1)
    expect(fade(1, false).fade).toBe(1)
    expect(fade(1, true)).toEqual({ own: 0, above: 0, fade: 1 })
  })

  it("rests every layer but the top one covered", () => {
    expect(restingLayerProgress(2, 2)).toEqual({ own: 0, above: 1, fade: 1 })
    expect(restingLayerProgress(1, 2)).toEqual({ own: 0, above: 0, fade: 1 })
  })

  it("matches the end pose of a push to the resting pose, so settling never jumps", () => {
    for (const index of [0, 1, 2]) {
      expect(push(index, true)).toEqual(restingLayerProgress(index, 2))
    }
  })
})

describe("webLayerCss", () => {
  it("parks an incoming page at the travel ratio, fully faded", () => {
    const css = webLayerCss({ own: 1, above: 1, fade: 1 }, WIDTH, ANIMATED)
    expect(css.transform).toBe(px(WIDTH * MOTION.pageTravelRatio))
    expect(css.opacity).toBe(0)
    expect(css.scrimOpacity).toBe(0)
  })

  it("parallaxes a covered page left under the scrim", () => {
    const css = webLayerCss({ own: 0, above: 0, fade: 1 }, WIDTH, ANIMATED)
    expect(css.transform).toBe(px(-WIDTH * MOTION.pageParallaxRatio))
    expect(css.opacity).toBe(1)
    expect(css.scrimOpacity).toBe(MOTION.pageScrimOpacity)
  })

  it("moves nothing under reduced motion", () => {
    expect(webLayerCss({ own: 1, above: 1, fade: 1 }, WIDTH, REDUCED).transform).toBe("translateX(0px)")
    expect(webLayerCss({ own: 0, above: 0, fade: 1 }, WIDTH, REDUCED).transform).toBe("translateX(0px)")
  })

  it("multiplies the cross-fade into the layer opacity", () => {
    expect(webLayerCss({ own: 0, above: 1, fade: 0 }, WIDTH, ANIMATED).opacity).toBe(0)
  })
})

describe("webLayerTransition", () => {
  it("draws the start pose with no transition, and an instant plan never transitions", () => {
    expect(webLayerTransition(pageTransitionPlan("push", false, TIMING), false)).toBe("none")
    expect(webLayerTransition(INSTANT_PAGE_PLAN, true)).toBe("none")
  })

  it("animates transform and opacity over the plan's duration once flipped", () => {
    const transition = webLayerTransition(pageTransitionPlan("push", false, TIMING), true)
    expect(transition).toContain(`transform ${MOTION.pagePush.duration}ms`)
    expect(transition).toContain(`opacity ${MOTION.pagePush.duration}ms`)
    expect(webLayerTransition(pageTransitionPlan("replace", false, TIMING), true)).toContain(
      `opacity ${MOTION.bodyReplace.duration}ms`,
    )
  })
})
