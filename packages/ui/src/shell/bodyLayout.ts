import type { DetailEntry, DetailKind, View } from "../nav"
import { resolveTabBarFootprint } from "./tabBarLogic"

export type BodyLayout = "scroll" | "full"

export const BODY_LAYOUT: Record<DetailKind | "home-view", BodyLayout> = {
  thread: "full",
  "pinned-messages": "full",
  "new-group": "full",
  "new-channel": "full",
  composer: "full",
  "post-thread": "full",
  post: "scroll",
  saves: "scroll",
  pin: "scroll",
  cleanup: "scroll",
  person: "full",
  myreports: "scroll",
  cleanups: "scroll",
  people: "scroll",
  messages: "scroll",
  "new-msg": "scroll",
  activity: "scroll",
  "notification-prefs": "scroll",
  profile: "scroll",
  "create-cleanup": "scroll",
  "edit-cleanup": "scroll",
  cluster: "scroll",
  blend: "scroll",
  followers: "scroll",
  following: "scroll",
  leaderboard: "scroll",
  members: "scroll",
  "group-info": "scroll",
  blocked: "scroll",
  "language-settings": "scroll",
  "appearance-settings": "scroll",
  settings: "scroll",
  "settings-account": "scroll",
  "settings-privacy": "scroll",
  "drop-pin": "scroll",
  "host-mode": "scroll",
  "host-checkin": "scroll",
  "host-broadcast-quick": "scroll",
  "host-team": "scroll",
  "host-log-hours": "scroll",
  "my-ticket": "scroll",
  org: "scroll",
  "my-donations": "scroll",
  "event-dashboard": "scroll",
  "home-view": "scroll",
}


const PERMANENT_SHEET_KINDS = ["drop-pin"] as const satisfies readonly DetailKind[]

const PENDING_CONVERSION_KINDS = [] as const satisfies readonly DetailKind[]

export const SHEET_ONLY_KINDS: ReadonlySet<DetailKind> = new Set<DetailKind>([
  ...PERMANENT_SHEET_KINDS,
  ...PENDING_CONVERSION_KINDS,
])

export function resolveBodyLayout(
  kind: DetailKind | "home-view",
  fullPageDetails: boolean,
): BodyLayout {
  if (!fullPageDetails || kind === "home-view") return BODY_LAYOUT[kind]
  return SHEET_ONLY_KINDS.has(kind) ? BODY_LAYOUT[kind] : "full"
}

export type PortraitDetailPresentation = "none" | "sheet" | "full"

export interface PortraitShellPlan {
  mountMap: boolean
  mountMapControls: boolean
  renderBaseBody: boolean
  detailPresentation: PortraitDetailPresentation
  bottomChromeVisible: boolean
  surfaceKeyboardAvoidance: boolean
}

export interface PortraitFrameLayerPlan {
  bodyMounted: boolean
  bottomInset: number
  entry: DetailEntry | null
  transitionKey: string
  zIndex: number
}

export interface PortraitFramePlan {
  base: PortraitFrameLayerPlan
  overlay: PortraitFrameLayerPlan & {
    keyboardAvoidance: boolean
    interactive: boolean
    entries: DetailEntry[]
    layerKeys: string[]
  }
  sheet: { visible: boolean }
  bottomChrome: { footprint: number; visible: boolean; zIndex: number }
}

const PORTRAIT_LAYER_Z = {
  base: 0,
  overlay: 55,
  bottomChrome: 65,
} as const

export function portraitSurfaceTransitionKey(
  view: View,
  active: DetailEntry | null,
  presentation: PortraitDetailPresentation,
): string {
  if (presentation !== "full" || !active) return `view:${view}`
  if (active.kind === "composer") {
    return `composer:${active.composerMode ?? "post"}:${active.targetPostId ?? ""}`
  }
  return `${active.kind}:${active.id ?? active.slug ?? active.geoid ?? ""}`
}

export function topmostFullEntry(
  stack: readonly DetailEntry[],
  fullPageDetails = false,
): DetailEntry | null {
  const entries = fullEntryStack(stack, fullPageDetails)
  return entries[entries.length - 1] ?? null
}

export function fullEntryStack(
  stack: readonly DetailEntry[],
  fullPageDetails = false,
): DetailEntry[] {
  const entries: DetailEntry[] = []
  for (const entry of stack) {
    if (entry && entry.kind !== "view" && resolveBodyLayout(entry.kind, fullPageDetails) === "full") {
      entries.push(entry)
    }
  }
  return entries
}

export function pageLayerKey(view: View, entry: DetailEntry, depth: number): string {
  return `${depth}:${portraitSurfaceTransitionKey(view, entry, "full")}`
}

export function portraitFramePlan(
  view: View,
  active: DetailEntry | null,
  shellPlan: PortraitShellPlan,
  measuredTabBarHeight: number,
  bottomChromeFallback: number,
  stack: readonly DetailEntry[] = active ? [active] : [],
  fullPageDetails = false,
): PortraitFramePlan {
  const footprint = resolveTabBarFootprint(measuredTabBarHeight, bottomChromeFallback)
  const overlayEntries = fullEntryStack(stack, fullPageDetails)
  const overlayEntry = overlayEntries[overlayEntries.length - 1] ?? null
  const overlayMounted = overlayEntry !== null

  return {
    base: {
      bodyMounted: shellPlan.renderBaseBody,
      bottomInset: footprint,
      entry: null,
      transitionKey: portraitSurfaceTransitionKey(view, null, "none"),
      zIndex: PORTRAIT_LAYER_Z.base,
    },
    overlay: {
      bodyMounted: overlayMounted,
      bottomInset: shellPlan.bottomChromeVisible ? footprint : 0,
      entry: overlayEntry,
      transitionKey: overlayMounted
        ? portraitSurfaceTransitionKey(view, overlayEntry, "full")
        : "overlay:none",
      entries: overlayEntries,
      layerKeys: overlayEntries.map((entry, depth) => pageLayerKey(view, entry, depth)),
      zIndex: PORTRAIT_LAYER_Z.overlay,
      keyboardAvoidance: overlayMounted && shellPlan.surfaceKeyboardAvoidance,
      interactive: shellPlan.detailPresentation !== "sheet",
    },
    sheet: { visible: shellPlan.detailPresentation === "sheet" },
    bottomChrome: {
      footprint,
      visible: shellPlan.bottomChromeVisible,
      zIndex: PORTRAIT_LAYER_Z.bottomChrome,
    },
  }
}


export function effectiveBaseView(view: View, lastNonSearchView: View, searchIsOverlay: boolean): View {
  return searchIsOverlay && view === "search" ? lastNonSearchView : view
}

export const SEARCH_REVEAL_WINDOW = [0.3, 0.8] as const

export function searchRevealStyle(progress: number): { opacity: number; translateY: number } {
  "worklet"
  const start = 0.3
  const end = 0.8
  const raw = (progress - start) / (end - start)
  const w = raw < 0 ? 0 : raw > 1 ? 1 : raw
  return { opacity: w, translateY: (1 - w) * 12 }
}

export const SEARCH_REVEAL_EXIT_WINDOW = [0.2, 0.7] as const

export function searchRevealExitStyle(progress: number): { opacity: number; translateY: number } {
  "worklet"
  const start = 0.2
  const end = 0.7
  const raw = (progress - start) / (end - start)
  const w = raw < 0 ? 0 : raw > 1 ? 1 : raw
  return { opacity: w, translateY: (1 - w) * 12 }
}

export function portraitShellPlan(
  view: View,
  active: DetailEntry | null,
  fullPageDetails = false,
  retainMap = false,
): PortraitShellPlan {
  const mapActive = view === "map"
  const detailLayout =
    active && active.kind !== "view" ? resolveBodyLayout(active.kind, fullPageDetails) : null
  const fullDetailModal =
    active?.kind === "composer" || active?.kind === "post-thread" || active?.kind === "person"
  const detailPresentation: PortraitDetailPresentation =
    detailLayout === "full" ? "full" : detailLayout === "scroll" ? "sheet" : "none"

  return {
    mountMap: mapActive || retainMap,
    mountMapControls: mapActive,
    renderBaseBody: view !== "map",
    detailPresentation,
    bottomChromeVisible: fullPageDetails
      ? detailPresentation === "none"
      : !fullDetailModal && detailPresentation !== "sheet",
    surfaceKeyboardAvoidance: active?.kind === "composer",
  }
}

export function reportDraftStartsFresh(draftMediaCount: number): boolean {
  return draftMediaCount === 0
}
