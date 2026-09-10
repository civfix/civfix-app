import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { MOTION } from "../../theme/motion"
import type { DetailLeadingAffordance } from "../backAffordance"
import {
  backPressDecision,
  canSwipeBack,
  pageLayerPointerEvents,
  pageLayerStyle,
  pageLayerTokens,
  pageTransitionPlan,
  swipeBackDecision,
  type PageMotionTokens,
  type PageTransitionTiming,
  type SwipeBackTokens,
} from "../pageStackModel"

const WIDTH = 390
const RATIO = MOTION.pageParallaxRatio
const TRAVEL = MOTION.pageTravelRatio
const SCRIM = MOTION.pageScrimOpacity
const PAGE_MOTION: PageMotionTokens = {
  travelRatio: TRAVEL,
  parallaxRatio: RATIO,
  scrimOpacity: SCRIM,
}
const ANIMATED = pageLayerTokens(PAGE_MOTION, false, false)
const DRAG = pageLayerTokens(PAGE_MOTION, false, true)
const REDUCED = pageLayerTokens(PAGE_MOTION, true, false)
const REDUCED_DRAG = pageLayerTokens(PAGE_MOTION, true, true)
const TOKENS: SwipeBackTokens = {
  completeFraction: MOTION.pageCompleteFraction,
  completeVelocity: MOTION.pageCompleteVelocity,
}
const TIMING: PageTransitionTiming = {
  pushDuration: MOTION.pagePush.duration,
  popDuration: MOTION.pagePop.duration,
  fadeDuration: MOTION.bodyReplace.duration,
}

const UNCOVERED = 1

describe("pageLayerTokens - one motion language, two drivers", () => {
  it("gives an ANIMATED push a partial travel plus a fade - the slide-fade, not a full-width shove", () => {
    expect(ANIMATED.travelRatio).toBe(TRAVEL)
    expect(ANIMATED.travelRatio).toBeGreaterThan(0)
    expect(ANIMATED.travelRatio).toBeLessThan(1)
    expect(ANIMATED.fadeStrength).toBe(1)
  })

  it("keeps a DRAGGED page pinned to the finger: full width, never faded", () => {
    expect(DRAG.travelRatio).toBe(1)
    expect(DRAG.fadeStrength).toBe(0)
    expect(DRAG.parallaxRatio).toBe(ANIMATED.parallaxRatio)
  })

  it("recedes the under-page LESS than the incoming page travels", () => {
    expect(ANIMATED.parallaxRatio).toBeGreaterThan(0)
    expect(ANIMATED.parallaxRatio).toBeLessThan(ANIMATED.travelRatio)
  })

  it("strips every positional channel for reduce-motion, and keeps the finger 1:1", () => {
    expect(REDUCED.travelRatio).toBe(0)
    expect(REDUCED.parallaxRatio).toBe(0)
    expect(REDUCED.fadeStrength).toBe(0)
    expect(REDUCED_DRAG.travelRatio).toBe(1)
    expect(REDUCED_DRAG.parallaxRatio).toBe(0)
    expect(REDUCED_DRAG.fadeStrength).toBe(0)
  })
})

describe("pageLayerStyle - where a page sits", () => {
  it("puts an uncovered, un-slid page at rest, opaque, with no dim", () => {
    const layer = pageLayerStyle(0, UNCOVERED, WIDTH, ANIMATED)
    expect(layer.translateX).toBe(0)
    expect(layer.opacity).toBe(1)
    expect(layer.scrimOpacity).toBe(0)
  })

  it("slides an ANIMATED page a FRACTION of the width off to the right, fading as it goes", () => {
    const gone = pageLayerStyle(1, UNCOVERED, WIDTH, ANIMATED)
    expect(gone.translateX).toBe(WIDTH * TRAVEL)
    expect(gone.opacity).toBe(0)
    expect(pageLayerStyle(0.5, UNCOVERED, WIDTH, ANIMATED).translateX).toBe((WIDTH * TRAVEL) / 2)
    expect(pageLayerStyle(0.5, UNCOVERED, WIDTH, ANIMATED).opacity).toBe(0.5)
  })

  it("keeps a DRAGGED page under the finger for the whole width, at full opacity", () => {
    expect(pageLayerStyle(1, UNCOVERED, WIDTH, DRAG).translateX).toBe(WIDTH)
    expect(pageLayerStyle(0.5, UNCOVERED, WIDTH, DRAG).translateX).toBe(WIDTH / 2)
    expect(pageLayerStyle(0.5, UNCOVERED, WIDTH, DRAG).opacity).toBe(1)
  })

  it("parks a fully COVERED page to the LEFT, dimmed - the parallax the reveal is made of", () => {
    const covered = pageLayerStyle(0, 0, WIDTH, ANIMATED)
    expect(covered.translateX).toBe(-WIDTH * RATIO)
    expect(covered.translateX).toBeLessThan(0)
    expect(covered.opacity).toBe(1)
    expect(covered.scrimOpacity).toBe(SCRIM)
  })

  it("walks a covered page back to rest, and undims it, exactly in step with the page above", () => {
    let lastX = -Infinity
    let lastScrim = Infinity
    for (let above = 0; above <= 1.0001; above += 0.05) {
      const layer = pageLayerStyle(0, above, WIDTH, ANIMATED)
      expect(layer.translateX).toBeGreaterThan(lastX)
      expect(layer.scrimOpacity).toBeLessThan(lastScrim)
      lastX = layer.translateX
      lastScrim = layer.scrimOpacity
    }
    expect(pageLayerStyle(0, 1, WIDTH, ANIMATED).translateX).toBeCloseTo(0, 10)
    expect(pageLayerStyle(0, 1, WIDTH, ANIMATED).scrimOpacity).toBeCloseTo(0, 10)
  })

  it("SURVIVES THE HANDOFF: promoting a layer between the two shared values moves nothing", () => {
    for (const p of [0.1, 0.37, 0.5, 0.83]) {
      const swipedBefore = pageLayerStyle(p, UNCOVERED, WIDTH, DRAG)
      const swipedAfter = pageLayerStyle(p, UNCOVERED, WIDTH, DRAG)
      expect(swipedAfter).toEqual(swipedBefore)
      const beneathBefore = pageLayerStyle(0, p, WIDTH, DRAG)
      const beneathAfter = pageLayerStyle(0, p, WIDTH, DRAG)
      expect(beneathAfter).toEqual(beneathBefore)
    }
    expect(pageLayerStyle(0, 1, WIDTH, ANIMATED)).toEqual(
      pageLayerStyle(0, UNCOVERED, WIDTH, ANIMATED),
    )
  })

  it("clamps a rubber-banded finger so no layer can leave its rail", () => {
    expect(pageLayerStyle(-0.4, UNCOVERED, WIDTH, DRAG).translateX).toBe(0)
    expect(pageLayerStyle(1.9, UNCOVERED, WIDTH, DRAG).translateX).toBe(WIDTH)
    expect(pageLayerStyle(-0.4, UNCOVERED, WIDTH, ANIMATED).opacity).toBe(1)
    expect(pageLayerStyle(1.9, UNCOVERED, WIDTH, ANIMATED).opacity).toBe(0)
    expect(pageLayerStyle(0, 1.4, WIDTH, ANIMATED).scrimOpacity).toBe(0)
    expect(pageLayerStyle(0, -0.6, WIDTH, ANIMATED).scrimOpacity).toBe(SCRIM)
  })

  it("collapses to a pure crossfade geometry under reduce-motion", () => {
    expect(pageLayerStyle(0, 0, WIDTH, REDUCED).translateX).toBe(0)
    expect(pageLayerStyle(1, 1, WIDTH, REDUCED).translateX).toBe(0)
    expect(pageLayerStyle(1, 1, WIDTH, REDUCED).opacity).toBe(1)
    expect(pageLayerStyle(0, 0, WIDTH, REDUCED).scrimOpacity).toBe(SCRIM)
  })
})

describe("swipeBackDecision - when a released edge swipe commits", () => {
  it("completes past half the screen on distance alone", () => {
    expect(swipeBackDecision(WIDTH * 0.51, 0, WIDTH, TOKENS)).toBe("complete")
    expect(swipeBackDecision(WIDTH * 0.49, 0, WIDTH, TOKENS)).toBe("cancel")
    expect(swipeBackDecision(WIDTH * TOKENS.completeFraction, 0, WIDTH, TOKENS)).toBe("complete")
  })

  it("completes a FLICK from the edge that never travelled far", () => {
    expect(swipeBackDecision(30, TOKENS.completeVelocity + 1, WIDTH, TOKENS)).toBe("complete")
    expect(swipeBackDecision(30, TOKENS.completeVelocity - 1, WIDTH, TOKENS)).toBe("cancel")
  })

  it("CANCELS a hard leftward flick even from past the distance threshold", () => {
    expect(swipeBackDecision(WIDTH * 0.8, -TOKENS.completeVelocity, WIDTH, TOKENS)).toBe("cancel")
    expect(swipeBackDecision(WIDTH * 0.95, -2000, WIDTH, TOKENS)).toBe("cancel")
    expect(swipeBackDecision(WIDTH * 0.8, -50, WIDTH, TOKENS)).toBe("complete")
  })

  it("cancels a backwards or stationary gesture outright", () => {
    expect(swipeBackDecision(0, 0, WIDTH, TOKENS)).toBe("cancel")
    expect(swipeBackDecision(-80, 0, WIDTH, TOKENS)).toBe("cancel")
  })

  it("cancels when the host has no measured width rather than dividing by it", () => {
    expect(swipeBackDecision(500, 3000, 0, TOKENS)).toBe("cancel")
    expect(swipeBackDecision(500, 3000, -1, TOKENS)).toBe("cancel")
  })
})

describe("pageTransitionPlan - what each stack change animates", () => {
  it("slides a PUSH in from one full width off to the right", () => {
    const plan = pageTransitionPlan("push", false, TIMING)
    expect(plan).toEqual({
      slide: true,
      retainLeaving: false,
      fromFront: 1,
      duration: TIMING.pushDuration,
      fadeDuration: 0,
    })
  })

  it("RETAINS the outgoing page on a pop - the only direction with an exit to play", () => {
    const pop = pageTransitionPlan("pop", false, TIMING)
    expect(pop.retainLeaving).toBe(true)
    expect(pop.slide).toBe(true)
    expect(pop.duration).toBe(TIMING.popDuration)
    expect(pop.fromFront).toBe(0)
    expect(pageTransitionPlan("push", false, TIMING).retainLeaving).toBe(false)
  })

  it("makes a lateral REPLACE a pure crossfade with no travel and nothing retained", () => {
    const plan = pageTransitionPlan("replace", false, TIMING)
    expect(plan.slide).toBe(false)
    expect(plan.retainLeaving).toBe(false)
    expect(plan.fromFront).toBe(0)
    expect(plan.duration).toBe(0)
    expect(plan.fadeDuration).toBe(TIMING.fadeDuration)
  })

  it("drops the SLIDE for reduce-motion in every direction, and keeps the fade", () => {
    for (const direction of ["push", "pop", "replace"] as const) {
      const plan = pageTransitionPlan(direction, true, TIMING)
      expect(plan.slide, direction).toBe(false)
      expect(plan.fromFront, direction).toBe(0)
      expect(plan.fadeDuration, direction).toBe(TIMING.fadeDuration)
      expect(plan.retainLeaving, direction).toBe(false)
    }
  })

  it("never exceeds the motion vocabulary's exit-is-not-slower-than-entrance contract", () => {
    expect(pageTransitionPlan("pop", false, TIMING).duration).toBeLessThanOrEqual(
      pageTransitionPlan("push", false, TIMING).duration,
    )
  })
})

describe("canSwipeBack - when the edge gesture is armed", () => {
  const armed = (over: Partial<Parameters<typeof canSwipeBack>[0]> = {}) =>
    canSwipeBack({
      layerCount: 2,
      leading: "back",
      interactive: true,
      platformIsIOS: true,
      discardsFlow: false,
      ...over,
    })

  it("arms on a genuine drill-down", () => {
    expect(armed()).toBe(true)
  })

  it("arms at DEPTH 1 too - the base tab surface underneath is a real destination", () => {
    expect(armed({ layerCount: 1 })).toBe(true)
  })

  it("REFUSES a root flow page, whose control is an honest close X", () => {
    expect(armed({ leading: "close" })).toBe(false)
    expect(armed({ leading: "close", layerCount: 1 })).toBe(false)
    expect(armed({ leading: "back", layerCount: 2, discardsFlow: false })).toBe(true)
  })

  it("REFUSES when the page being popped IS the flow, however deep it sits", () => {
    expect(armed({ leading: "back", layerCount: 2, discardsFlow: true })).toBe(false)
    expect(armed({ leading: "back", layerCount: 4, discardsFlow: true })).toBe(false)
    expect(armed({ leading: "close", discardsFlow: true })).toBe(false)
  })

  it("refuses when the header offers no control at all", () => {
    expect(armed({ leading: "none" as DetailLeadingAffordance })).toBe(false)
  })

  it("refuses while a SHEET rides above the page", () => {
    expect(armed({ interactive: false })).toBe(false)
  })

  it("refuses with no page mounted", () => {
    expect(armed({ layerCount: 0 })).toBe(false)
  })

  it("is iOS-ONLY: Android 10+ owns the left edge and would pop twice", () => {
    expect(armed({ platformIsIOS: false })).toBe(false)
    expect(armed({ platformIsIOS: false, layerCount: 4 })).toBe(false)
  })

  it("nested in a native stack, depth 1 DISARMS - the enclosing route's own swipe-back owns that pop", () => {
    expect(armed({ layerCount: 1, nestedInNativeStack: true })).toBe(false)
  })

  it("nested in a native stack, genuine in-shell drill-downs still arm", () => {
    expect(armed({ layerCount: 2, nestedInNativeStack: true })).toBe(true)
    expect(armed({ layerCount: 4, nestedInNativeStack: true })).toBe(true)
  })

  it("nesting never overrides the other refusals", () => {
    expect(armed({ layerCount: 2, nestedInNativeStack: true, discardsFlow: true })).toBe(false)
    expect(armed({ layerCount: 2, nestedInNativeStack: true, platformIsIOS: false })).toBe(false)
    expect(armed({ layerCount: 2, nestedInNativeStack: true, interactive: false })).toBe(false)
  })

  it("un-nested hosts keep the depth-1 arming, explicitly and by default", () => {
    expect(armed({ layerCount: 1, nestedInNativeStack: false })).toBe(true)
    expect(armed({ layerCount: 1 })).toBe(true)
  })
})

describe("pageLayerPointerEvents - who may be touched during a pop", () => {
  it("keeps the active page interactive when nothing is leaving", () => {
    expect(pageLayerPointerEvents({ active: true, isLeaving: false, hasLeaving: false })).toBe("auto")
  })

  it("makes the LEAVING layer swallow touches for its whole exit", () => {
    expect(pageLayerPointerEvents({ active: false, isLeaving: true, hasLeaving: true })).toBe("box-only")
  })

  it("keeps the revealed page untouchable until the exit completes", () => {
    expect(pageLayerPointerEvents({ active: true, isLeaving: false, hasLeaving: true })).toBe("none")
  })

  it("keeps buried resident layers untouchable in every state", () => {
    expect(pageLayerPointerEvents({ active: false, isLeaving: false, hasLeaving: false })).toBe("none")
    expect(pageLayerPointerEvents({ active: false, isLeaving: false, hasLeaving: true })).toBe("none")
  })
})

describe("backPressDecision - the back-chip double-tap gate", () => {
  const POP = MOTION.pagePop.duration

  it("accepts the first press", () => {
    expect(backPressDecision(1000, null, POP)).toBe("accept")
  })

  it("ignores a second press inside the pop duration", () => {
    expect(backPressDecision(1000 + POP - 1, 1000, POP)).toBe("ignore")
  })

  it("accepts again once the pop has finished", () => {
    expect(backPressDecision(1000 + POP, 1000, POP)).toBe("accept")
  })

  it("gates the DetailBar chip through the decision, on the pop duration", () => {
    const bar = readFileSync(new URL("../DetailBar.tsx", import.meta.url), "utf8")
    expect(bar).toMatch(/backPressDecision\(now, lastBackRef\.current, BACK_PRESS_WINDOW_MS\)/)
    expect(bar).toMatch(/const BACK_PRESS_WINDOW_MS = theme\.motion\.pagePop\.duration/)
    expect(bar).toMatch(/onPress=\{handleBack\}/)
  })
})

describe("PageStack.native: the gesture stays UI-thread safe and correctly scoped", () => {
  const src = readFileSync(new URL("../PageStack.native.tsx", import.meta.url), "utf8")
  const model = readFileSync(new URL("../pageStackModel.ts", import.meta.url), "utf8")

  it("gives the WORKLET directive to every model function a gesture/animation callback calls", () => {
    expect(model).toMatch(/export function pageLayerStyle\([^)]*\): PageLayerStyle \{\n {2}"worklet"/)
    expect(model).toMatch(/export function swipeBackDecision\([^)]*\): SwipeBackDecision \{\n {2}"worklet"/)
    expect(panChain()).toMatch(/swipeBackDecision\(e\.translationX, e\.velocityX, width, SWIPE_TOKENS\)/)
    expect(src).toMatch(/pageLayerStyle\(ownProgress, aboveProgress, width, tokens\)/)
  })

  it("switches the layer tokens off the DRAG shared value, inside the worklet", () => {
    expect(src).toMatch(/const dragging = useSharedValue\(0\)/)
    expect(src).toMatch(/const tokens = dragging\.value === 1 \? dragTokens : restTokens/)
    expect(panChain()).toMatch(/\.onStart\(\(\) => \{\s*dragging\.value = 1\s*\}\)/)
    expect(src).toMatch(/dragging\.value = 0/)
  })

  it("resolves every layer token from the motion vocabulary, never from a literal", () => {
    expect(src).toMatch(/travelRatio: theme\.motion\.pageTravelRatio/)
    expect(src).toMatch(/parallaxRatio: theme\.motion\.pageParallaxRatio/)
    expect(src).toMatch(/scrimOpacity: theme\.motion\.pageScrimOpacity/)
    expect(src).toMatch(/const ANIMATED_TOKENS = pageLayerTokens\(PAGE_MOTION, false, false\)/)
    expect(src).toMatch(/const DRAG_TOKENS = pageLayerTokens\(PAGE_MOTION, false, true\)/)
    expect(src).toMatch(/const REDUCED_TOKENS = pageLayerTokens\(PAGE_MOTION, true, false\)/)
    expect(src).toMatch(/const REDUCED_DRAG_TOKENS = pageLayerTokens\(PAGE_MOTION, true, true\)/)
  })

  it("short-circuits to the reduced token set from the OS reduce-motion flag", () => {
    expect(src).toMatch(/const restTokens = reduceMotion \? REDUCED_TOKENS : ANIMATED_TOKENS/)
    expect(src).toMatch(/const dragTokens = reduceMotion \? REDUCED_DRAG_TOKENS : DRAG_TOKENS/)
    expect(src).toMatch(/AccessibilityInfo\.isReduceMotionEnabled\(\)/)
    expect(src).toMatch(/pageTransitionPlan\(direction, reduceMotion, TIMING\)/)
  })

  it("carries the incoming page's own fade alongside the replace crossfade", () => {
    expect(src).toMatch(/opacity: \(fades \? fade\.value : 1\) \* layer\.opacity/)
  })

  it("refuses the swipe when the pop would DISCARD the flow it is standing on", () => {
    expect(src).toMatch(/const topEntry = stack\[stack\.length - 1\]/)
    expect(src).toMatch(/discardsFlow: topEntry !== undefined && isFlowKind\(topEntry\.kind\)/)
    expect(src).not.toMatch(/discardsFlow: stack\.some/)
  })

  it("hands each layer the stack slice that ENDS at its own entry", () => {
    expect(src).toMatch(
      /const stackSlices = useMemo\(\(\) => stack\.map\(\(_, index\) => stack\.slice\(0, index \+ 1\)\), \[stack\]\)/,
    )
    expect(src).toMatch(/stack: stackSlices\[stack\.indexOf\(entry\)\] \?\? stack/)
    expect(src).toMatch(/rendered\.push\(\{ key: leaving\.key, entry: leaving\.entry, stack: leaving\.stack \}\)/)
  })

  it("scopes the injected keyboard-aware scroll host to the ACTIVE layer", () => {
    const kb = readFileSync(new URL("../KeyboardAwareScroll.native.tsx", import.meta.url), "utf8")
    expect(kb).toContain("const pageActive = usePageIsActive()")
    expect(kb).toMatch(/if \(!pageActiveRef\.current \|\| !ownsFocusedInput\(\)\) return/)
    expect(kb).toMatch(/pageActiveRef\.current && reserveKeyboardPadding\(\) \? overlapOf\(e\) : 0/)
    expect(src).toMatch(/<ScrollHostProvider value=\{scrollHost\}>\s*\n\s*<PageActiveProvider value=\{active\}>/)
  })

  const panChain = () => {
    const start = src.indexOf("Gesture.Pan()\n")
    expect(start).toBeGreaterThan(-1)
    const end = src.indexOf("[commitSwipeBack", start)
    expect(end).toBeGreaterThan(start)
    return src.slice(start, end).replace(/\/\/[^\n]*/g, "")
  }

  it("calls NO config factory inside the pan chain - only the hoisted consts", () => {
    const chain = panChain()
    expect(chain).not.toMatch(/pageSwipeSettleConfig\(\)/)
    expect(chain).not.toMatch(/pageSwipeCancelConfig\(\)/)
    expect(chain).not.toMatch(/pagePushConfig\(\)/)
    expect(chain).not.toMatch(/pagePopConfig\(\)/)
    expect(chain).not.toMatch(/timingConfig\(/)
    expect(chain).not.toMatch(/\w+Config\(\)/)
    expect(chain).toMatch(/withTiming\(0, CANCEL_CFG,/)
  })

  it("builds all four page curves ONCE, at module scope, on the JS thread", () => {
    for (const line of [
      "const PUSH_CFG = pagePushConfig()",
      "const POP_CFG = pagePopConfig()",
      "const SETTLE_CFG = pageSwipeSettleConfig()",
      "const CANCEL_CFG = pageSwipeCancelConfig()",
    ]) {
      expect(src).toContain(line)
    }
  })

  it("arms only the LEFT EDGE STRIP, and yields to vertical scrolling", () => {
    const chain = panChain()
    expect(chain).toMatch(/\.hitSlop\(\{ left: 0, width: EDGE_WIDTH \}\)/)
    expect(chain).toMatch(/\.activeOffsetX\(ACTIVATE_X\)/)
    expect(chain).toMatch(/\.failOffsetY\(\[-FAIL_Y, FAIL_Y\]\)/)
    expect(chain).toMatch(/\.enabled\(swipeArmed\)/)
  })

  it("commits the pop through the nav store from the JS thread only", () => {
    const chain = panChain()
    expect(chain).toMatch(/runOnJS\(commitSwipeBack\)\(front\.value\)/)
    expect(chain).not.toMatch(/useNavStore/)
    expect(src).toMatch(/useNavStore\.getState\(\)\.back\(\)/)
  })

  it("keys its layers by DEPTH so a page survives moving front <-> under", () => {
    expect(src).toMatch(/key: layerKeys\[depth\]/)
    expect(src).toMatch(/key=\{layer\.key\}/)
  })

  it("renders the retained leaving layer INSIDE the same array, never as a sibling", () => {
    expect(src).toMatch(/if \(leaving\) rendered\.push\(/)
    expect(src).toMatch(/\{rendered\.map\(\(layer, index\) => \(/)
    expect(src).not.toMatch(/\{leaving \? \(\s*<PageLayer/)
  })

  it("puts the safe-area padding INSIDE the layer, on its own box", () => {
    expect(src).toMatch(/style=\{\[styles\.layer, layerStyle\]\}/)
    expect(src).toMatch(/<View style=\{\[styles\.layerContent, \{ paddingBottom, paddingTop \}\]\}>/)
    expect(src).toMatch(/layer: \{\s*\.\.\.StyleSheet\.absoluteFillObject,\s*backgroundColor: t\.colors\.bg,/)
    const portrait = readFileSync(new URL("../PortraitShell.shared.tsx", import.meta.url), "utf8")
    expect(portrait).toMatch(/insets=\{overlayInsets\}/)
    expect(portrait).not.toMatch(/\{ zIndex: frame\.overlay\.zIndex \},\s*\n\s*overlayInsets,/)
  })

  it("hides every non-active layer from touches AND from the accessibility tree", () => {
    expect(src).toMatch(/pointerEvents=\{pointer\}/)
    expect(src).toMatch(/pointer=\{pageLayerPointerEvents\(\{/)
    expect(src).toMatch(/isLeaving: leaving !== null && index === topIndex,/)
    expect(src).toMatch(/hasLeaving: leaving !== null,/)
    expect(src).toMatch(/accessibilityElementsHidden=\{!active\}/)
    expect(src).toMatch(/importantForAccessibility=\{active \? "auto" : "no-hide-descendants"\}/)
  })

  it("declares only ONE keyboard-avoiding layer, and only ONE active one", () => {
    expect(src).toMatch(/keyboardAvoidance=\{keyboardAvoidance && index === realTopIndex\}/)
    expect(src).toMatch(/active=\{index === realTopIndex\}/)
    expect(src).toMatch(/const realTopIndex = entries\.length - 1/)
  })
})

describe("PageStack.web: the web page host did not move", () => {
  const web = readFileSync(new URL("../PageStack.web.tsx", import.meta.url), "utf8")

  it("stays a SINGLE-body host with no gesture and no layering", () => {
    expect(web).not.toMatch(/^import[^\n]*react-native-reanimated/m)
    expect(web).not.toMatch(/^import[^\n]*react-native-gesture-handler/m)
    expect(web).not.toMatch(/Gesture\.\w/)
    expect(web).not.toMatch(/useAnimatedStyle|useSharedValue/)
    expect(web).toContain("<BodyTransition transitionKey={transitionKey} direction={direction}>")
  })

  it("keeps the safe-area inset and the keyboard inset on TWO nested boxes", () => {
    expect(web).toMatch(/<View style=\{\[styles\.host, insets\]\}>/)
    expect(web).toMatch(/style=\{\[styles\.hostContent, webKeyboardInset\]\}/)
  })

  it("keeps the header gated on hasDetailHeader, so an own-header body gets no phantom gap", () => {
    expect(web).toMatch(/bodyMounted && hasDetailHeader\(entry\)/)
  })
})
