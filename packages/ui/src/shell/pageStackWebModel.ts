import type { BodyTransitionDirection } from "./BodyTransition.types"
import { cssTransitionParts } from "./motionCss"
import {
  pageLayerStyle,
  pageTransitionPlan,
  type PageLayerTokens,
  type PageTransitionPlan,
  type PageTransitionTiming,
} from "./pageStackModel"

export interface WebPageTransitionContext {
  restored: boolean
  reduceMotion: boolean
  keyboardBound: boolean
  coarsePointer: boolean
}

export const INSTANT_PAGE_PLAN: PageTransitionPlan = {
  slide: false,
  retainLeaving: false,
  fromFront: 0,
  duration: 0,
  fadeDuration: 0,
}

export function webPageTransitionPlan(
  direction: BodyTransitionDirection,
  context: WebPageTransitionContext,
  timing: PageTransitionTiming,
): PageTransitionPlan {
  if (context.restored) return INSTANT_PAGE_PLAN
  if (context.keyboardBound && context.coarsePointer) return INSTANT_PAGE_PLAN
  return pageTransitionPlan(direction, context.reduceMotion, timing)
}

export function isInstantPagePlan(plan: PageTransitionPlan): boolean {
  return plan.duration === 0 && plan.fadeDuration === 0
}

export function pagePlanDuration(plan: PageTransitionPlan): number {
  return plan.slide ? plan.duration : plan.fadeDuration
}

export interface WebLayerProgressInput {
  index: number
  topIndex: number
  hasLeaving: boolean
  direction: BodyTransitionDirection
  flipped: boolean
  slide: boolean
}

export interface WebLayerProgress {
  own: number
  above: number
  fade: number
}

export function restingLayerProgress(index: number, topIndex: number): WebLayerProgress {
  return { own: 0, above: index === topIndex ? 1 : 0, fade: 1 }
}

export function webLayerProgress({
  index,
  topIndex,
  hasLeaving,
  direction,
  flipped,
  slide,
}: WebLayerProgressInput): WebLayerProgress {
  const settled = flipped ? 1 : 0
  const moving = index === topIndex
  const under = index === topIndex - 1
  if (!slide) return { own: 0, above: moving ? 1 : 0, fade: moving ? settled : 1 }
  if (direction === "push") {
    return { own: moving ? 1 - settled : 0, above: moving ? 1 : under ? 1 - settled : 0, fade: 1 }
  }
  return { own: moving && hasLeaving ? settled : 0, above: moving ? 1 : under ? settled : 0, fade: 1 }
}

export interface WebLayerCss {
  transform: string
  opacity: number
  scrimOpacity: number
}

export function webLayerCss(
  progress: WebLayerProgress,
  width: number,
  tokens: PageLayerTokens,
): WebLayerCss {
  const layer = pageLayerStyle(progress.own, progress.above, width, tokens)
  return {
    transform: `translateX(${Math.round(layer.translateX * 100) / 100}px)`,
    opacity: layer.opacity * progress.fade,
    scrimOpacity: layer.scrimOpacity,
  }
}

export function webLayerTransition(plan: PageTransitionPlan, flipped: boolean): string {
  const duration = pagePlanDuration(plan)
  if (!flipped || duration === 0) return "none"
  return cssTransitionParts([
    ["transform", duration],
    ["opacity", duration],
  ])
}
