/**
 * The single decision that drives both app-download promo surfaces.
 *
 * Placement keys off the app's EXISTING layout mode (useLayoutMode, which is orientation-based:
 * `width >= height ? "expanded" : "compact"`) rather than introducing a competing device breakpoint:
 *
 *   compact  (portrait)           -> the fixed top banner, offering the one store for this platform
 *   expanded (landscape/desktop)  -> the section at the bottom of the home side card, with badges
 *
 * A desktop visitor resolves to platform "other", which matches no single store, so the banner never
 * appears on desktop even in a portrait-shaped window. The practical result for tablets: an iPad in
 * portrait gets the App Store banner, and the same iPad in landscape gets the side card section.
 *
 * Pure: no react, no globals. Both surfaces call it, so they can never disagree.
 */
import type { AppPlatform } from "./platform"

export interface AppPromoInput {
  /** False during the static-export prerender and the first client render (see AppPromoSurface below). */
  mounted: boolean
  /** The live orientation-derived layout mode from `useLayoutMode()`. */
  layoutMode: "compact" | "expanded"
  /** The detected store platform (`detectAppPlatform`). */
  platform: AppPlatform
  /** The persisted "not interested" flag (`useAppPromoStore`). */
  dismissed: boolean
  /** Running as an installed PWA (`isStandalonePWA`) - already "installed", so do not pitch. */
  standalone: boolean
}

export type AppPromoSurface = "banner" | "card" | "none"

export function appPromoSurface({
  mounted,
  layoutMode,
  platform,
  dismissed,
  standalone,
}: AppPromoInput): AppPromoSurface {
  // Before mount nothing renders: civfix-web is a Next STATIC EXPORT, so the prerendered HTML cannot know
  // the visitor's user agent. Deciding on the first client render instead would hydration-mismatch.
  if (!mounted) return "none"

  // The user said no once; never ask again on this browser. Permanent, no expiry.
  if (dismissed) return "none"

  // Already launched from the home screen - pitching a download here is pure noise.
  if (standalone) return "none"

  if (layoutMode === "compact") {
    // Portrait with no native app for this platform (a narrow desktop window) has nothing to offer.
    return platform === "other" ? "none" : "banner"
  }

  // Landscape/desktop: the side card section, whose badge set `storeLinksFor` narrows per platform.
  return "card"
}
