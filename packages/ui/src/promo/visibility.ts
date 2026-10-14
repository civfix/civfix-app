/**
 * The single decision that drives both promo surfaces, so they can never disagree. Placement keys off
 * useLayoutMode() rather than a competing device breakpoint: compact gets the top banner offering this
 * platform's one store, expanded gets the side-card section with badges. A desktop visitor is platform
 * "other", which matches no single store, so the banner never appears on desktop.
 */
import type { LayoutMode } from "../nav"
import type { AppPlatform } from "./platform"

export interface AppPromoInput {
  mounted: boolean
  layoutMode: LayoutMode
  platform: AppPlatform
  dismissed: boolean
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
  // The web app is a Next static export: the prerendered HTML cannot know the user agent, so deciding on
  // the first client render would cause a hydration mismatch.
  if (!mounted) return "none"

  if (dismissed) return "none"

  if (standalone) return "none"

  if (layoutMode === "compact") {
    return platform === "other" ? "none" : "banner"
  }

  return "card"
}
