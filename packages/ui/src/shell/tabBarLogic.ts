import type { Snap, View } from "../nav"
import { MOTION } from "../theme/motion"
import { clamp01 } from "../math/clamp"
import { DOCK_H, DOCK_MORPH_SHRINK, DOCK_MORPH_TOP_OFFSET } from "../surface/liquidGlass/liquidGlassModel"

export type TabId = "home" | "map" | "messages" | "report"


export const DOCK_MOUNT_MS = MOTION.dockMount.duration
export const DOCK_MOUNT_SCALE_FROM = 0.92

export interface TabSpec {
  id: TabId
  view: View | null
}

export const TAB_SPECS = [
  { id: "map", view: "map" },
  { id: "home", view: "home" },
  { id: "messages", view: "messaging" },
  { id: "report", view: "report" },
] as const satisfies readonly TabSpec[]

export const TAB_PILL_LOCK_COUNT = TAB_SPECS.findIndex((tab) => tab.id === "report")

export const TAB_ANIMATION_MS = MOTION.tabPill.duration
export const TAB_EASING_CSS = "cubic-bezier(.22,1,.36,1)"
export const TAB_BAR_HEIGHT = 60

export const TAB_ICON_SIZE = 25
/** The web dock's tab and search-orb glyphs, which the expanded rail repeats. */
export const DOCK_TAB_GLYPH_SIZE = 24
export const DOCK_ORB_GLYPH_SIZE = 22
export const TAB_ICON_STROKE_WIDTH = 2.4
export const TAB_ICON_CENTER_Y = DOCK_H / 2
export const TAB_PILL_INSET_Y = 4
export const TAB_PILL_INSET_X = 5

export function selectedPillRect(
  index: number,
  tabW: number,
): { x: number; y: number; width: number; height: number } {
  "worklet"
  const y = TAB_PILL_INSET_Y
  const height = DOCK_H - TAB_PILL_INSET_Y * 2
  const width = Math.max(tabW - TAB_PILL_INSET_X * 2, 0)
  const x = index * tabW + TAB_PILL_INSET_X
  return { x, y, width, height }
}

export const PILL_DRAG_RESISTANCE = 0.3

export function pillDragRect(
  fingerX: number,
  tabW: number,
  count: number,
): { x: number; y: number; width: number; height: number } {
  "worklet"
  const minC = tabW / 2
  const maxC = (count - 0.5) * tabW
  let center: number
  if (fingerX < minC) {
    center = minC - Math.min((minC - fingerX) * 0.3, TAB_PILL_INSET_X)
  } else if (fingerX > maxC) {
    center = maxC + Math.min((fingerX - maxC) * 0.3, TAB_PILL_INSET_X)
  } else {
    center = fingerX
  }
  const width = Math.max(tabW - TAB_PILL_INSET_X * 2, 0)
  return {
    x: center - width / 2,
    y: TAB_PILL_INSET_Y,
    width,
    height: DOCK_H - TAB_PILL_INSET_Y * 2,
  }
}

export function lockedIndexForPillCenter(centerX: number, tabW: number, count: number): number {
  "worklet"
  if (tabW <= 0 || count <= 0) return 0
  const index = Math.floor(centerX / tabW)
  return index < 0 ? 0 : index > count - 1 ? count - 1 : index
}

const TAB_BAR_TOP_PADDING = 8
const TAB_BAR_WEB_BOTTOM_PADDING = 12
const TAB_BAR_NATIVE_BOTTOM_PADDING = 8

export function activeTabIndex(view: View): number {
  return TAB_SPECS.findIndex((tab) => tab.view === view)
}

export function tabPillTransition(reduceMotion: boolean): string {
  if (reduceMotion) return "none"
  return ["transform", "opacity"]
    .map((property) => `${property} ${TAB_ANIMATION_MS}ms ${TAB_EASING_CSS}`)
    .join(", ")
}

export function compactBottomChrome(view: View): "tabs" | "docked-search" {
  return view === "search" ? "docked-search" : "tabs"
}

export function initialTabBarFootprint(
  platform: "native" | "web",
  safeAreaBottom = 0,
): number {
  const bottomPadding =
    platform === "native"
      ? TAB_BAR_NATIVE_BOTTOM_PADDING + Math.max(0, safeAreaBottom)
      : TAB_BAR_WEB_BOTTOM_PADDING
  return Math.round(TAB_BAR_HEIGHT + TAB_BAR_TOP_PADDING + bottomPadding)
}

export function resolveTabBarFootprint(measured: number, fallback: number): number {
  const measuredFootprint = Math.max(0, Math.round(measured))
  return measuredFootprint > 0 ? measuredFootprint : Math.max(1, Math.round(fallback))
}

export function searchMorphTarget(view: View): 0 | 1 {
  return view === "search" ? 1 : 0
}

export function resolvePreviousView(stored: View, view: View): View {
  return view === "search" ? stored : view
}

export function seedPreviousView(currentView: View, lastNonSearch: View): View {
  return currentView === "search" ? lastNonSearch : currentView
}

export function windowProgress(progress: number, start: number, end: number): number {
  "worklet"
  return clamp01((progress - start) / (end - start))
}


export const SCHEDULE = {
  tabIcon: [0, 0.4] as const,
  travel: [0.2, 0.95] as const,
  placeholder: [0.85, 1.0] as const,
  clear: [0.7, 1.0] as const,
} as const


export function tabIconMorph(progress: number): { opacity: number; blur: number } {
  "worklet"
  const w = windowProgress(progress, 0, 0.4)
  return { opacity: 1 - w, blur: w * 8 }
}

export function travelFactor(progress: number): number {
  "worklet"
  return windowProgress(progress, 0.2, 0.95)
}

export function placeholderMorph(progress: number): {
  opacity: number
  translateX: number
  blur: number
} {
  "worklet"
  const w = windowProgress(progress, 0.85, 1.0)
  return { opacity: w, translateX: (1 - w) * 8, blur: (1 - w) * 6 }
}

export const DOCK_SHEET_CLEAR = 32
export const DOCK_SHEET_COVERED = 260
export const DOCK_OCCLUSION_SINK = 12

export function dockOcclusionFromSheet(visibleSheetHeight: number): number {
  "worklet"
  return windowProgress(visibleSheetHeight, 32, 260)
}

export const DOCK_BOTTOM_MARGIN = 8

export type DockPlatform = "android" | "other"

export function dockBottomGap(safeAreaBottom: number, platform: DockPlatform = "other"): number {
  const inset = Math.max(0, safeAreaBottom)
  if (platform === "android") return inset + DOCK_BOTTOM_MARGIN
  return Math.max(inset - 12, DOCK_BOTTOM_MARGIN)
}

export function dockKeyboardRestOffset(
  safeAreaBottom: number,
  platform: DockPlatform = "other",
): number {
  return dockBottomGap(safeAreaBottom, platform) + (DOCK_MORPH_SHRINK - DOCK_MORPH_TOP_OFFSET)
}

export const SHEET_REF_SCREEN = 844
export const SHEET_REF_PEEK = 96
export const SHEET_REF_MID = 470
export const SHEET_REF_FULL = 786

export function sheetSnapPoints(windowHeight: number, topReserve: number): [number, number, number] {
  const scale = windowHeight / SHEET_REF_SCREEN
  const maxFull = windowHeight - topReserve
  const peek = Math.round(SHEET_REF_PEEK)
  const mid = Math.round(Math.min(SHEET_REF_MID * scale, maxFull))
  const full = Math.round(Math.min(SHEET_REF_FULL * scale, maxFull))
  const midStop = Math.max(mid, peek + 1)
  return [peek, midStop, Math.max(full, midStop + 1)]
}

export const SHEET_SNAP_RANGE = { min: 0, max: 2 } as const

export function stepSheetSnap(current: Snap, delta: number): Snap {
  return Math.min(Math.max(current + delta, SHEET_SNAP_RANGE.min), SHEET_SNAP_RANGE.max) as Snap
}

export function sheetSnapForAccessibilityAction(current: Snap, actionName: string): Snap | null {
  if (actionName === "increment") return stepSheetSnap(current, 1)
  if (actionName === "decrement") return stepSheetSnap(current, -1)
  return null
}

export function sheetSnapForKey(current: Snap, key: string | undefined): Snap | null {
  switch (key) {
    case "ArrowUp":
    case "ArrowRight":
      return stepSheetSnap(current, 1)
    case "ArrowDown":
    case "ArrowLeft":
      return stepSheetSnap(current, -1)
    case "Home":
      return SHEET_SNAP_RANGE.min
    case "End":
      return SHEET_SNAP_RANGE.max
    case "Enter":
    case " ":
      return ((current + 1) % (SHEET_SNAP_RANGE.max + 1)) as Snap
    default:
      return null
  }
}

/**
 * A slider key is consumed even at a bound (so it never scrolls the page), but only a changed snap is
 * applied: re-applying peek would run the settle-at-peek collapse again and pop one more detail per press.
 */
export function sheetSnapKeyOutcome(
  current: Snap,
  key: string | undefined,
): { consumed: boolean; next: Snap | null } {
  const next = sheetSnapForKey(current, key)
  if (next === null) return { consumed: false, next: null }
  return { consumed: true, next: next === current ? null : next }
}

const SHEET_SNAP_VALUE_KEYS = [
  "a11y.sheet_snap.collapsed",
  "a11y.sheet_snap.half",
  "a11y.sheet_snap.full",
] as const satisfies readonly string[]

export function sheetSnapValueKey(snap: Snap): (typeof SHEET_SNAP_VALUE_KEYS)[Snap] {
  return SHEET_SNAP_VALUE_KEYS[snap]
}

export function searchRiseTransition({
  coarsePointer,
  reduceMotion,
}: {
  coarsePointer: boolean
  reduceMotion: boolean
}): string {
  return coarsePointer || reduceMotion ? "none" : `transform ${TAB_ANIMATION_MS}ms ${TAB_EASING_CSS}`
}
