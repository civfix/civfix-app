export const EASE_STANDARD = [0.22, 1, 0.36, 1] as const
export const EASE_STANDARD_CSS = "cubic-bezier(0.22,1,0.36,1)"

export const EASE_GRAVITY = [0.5, 0, 0.3, 1.35] as const
export const EASE_GRAVITY_CSS = "cubic-bezier(0.5,0,0.3,1.35)"

export type EaseTuple = readonly [number, number, number, number]
export interface TimingRecipe {
  readonly duration: number
  readonly easing: EaseTuple
}
export const MOTION = {
  easing: EASE_STANDARD,
  easingCss: EASE_STANDARD_CSS,

  sheetMove: { duration: 240, easing: EASE_STANDARD } as TimingRecipe,
  sheetDismiss: { duration: 180, easing: EASE_STANDARD } as TimingRecipe,
  sheetTeardownGuardMs: 300,

  bodyPush: { duration: 240, easing: EASE_STANDARD } as TimingRecipe,
  bodyReplace: { duration: 160, easing: EASE_STANDARD } as TimingRecipe,
  bodyExit: { duration: 160, easing: EASE_STANDARD } as TimingRecipe,
  bodyFadeRatio: 0.6,
  bodyDistance: 24,

  pagePush: { duration: 260, easing: EASE_STANDARD } as TimingRecipe,
  pagePop: { duration: 200, easing: EASE_STANDARD } as TimingRecipe,
  pageSwipeSettle: { duration: 180, easing: EASE_STANDARD } as TimingRecipe,
  pageSwipeCancel: { duration: 180, easing: EASE_STANDARD } as TimingRecipe,
  pageTravelRatio: 0.28,
  pageParallaxRatio: 0.15,
  pageScrimOpacity: 0.12,
  pageEdgeWidth: 24,
  pageCompleteFraction: 0.5,
  pageCompleteVelocity: 700,

  menuIn: { duration: 160, easing: EASE_STANDARD } as TimingRecipe,
  menuOut: { duration: 120, easing: EASE_STANDARD } as TimingRecipe,
  menuScaleFrom: 0.95,

  dockMorphIn: { duration: 200, easing: EASE_STANDARD } as TimingRecipe,
  dockMorphOut: { duration: 200, easing: EASE_STANDARD } as TimingRecipe,
  dockFocus: { duration: 200, easing: EASE_STANDARD } as TimingRecipe,
  dockMinimize: { duration: 200, easing: EASE_STANDARD } as TimingRecipe,
  dockMount: { duration: 250, easing: EASE_STANDARD } as TimingRecipe,
  tabPill: { duration: 220, easing: EASE_STANDARD } as TimingRecipe,

  gravity: { duration: 420, easing: EASE_GRAVITY } as TimingRecipe,
  gravityStagger: 60,
  gravityDrop: 26,

  keyboardHandoffMs: 220,
  keyboardFallbackMs: 250,
  keyboardMaxMs: 600,
} as const
