/**
 * The React seam over the (pure, unit-tested) promo logic - the one hook BOTH surfaces call.
 *
 * It owns exactly one piece of impurity: reading the live `navigator` / `window` once, after mount, and
 * feeding them into `detectAppPlatform` / `isStandalonePWA`. Everything downstream is the pure
 * `appPromoSurface` decision, so the interesting behavior stays testable without a DOM.
 *
 * Why detection is deferred to an effect: civfix-web is a Next STATIC EXPORT. The prerendered HTML cannot
 * know the visitor's user agent, so deciding during the first render would hydration-mismatch. Until the
 * effect runs, `mounted` is false and `appPromoSurface` returns "none".
 */
import React from "react"
import { Platform } from "react-native"
import { useLayoutMode } from "../theme"
import { useAppPromoStore } from "./appPromoStore"
import {
  detectAppPlatform,
  isStandalonePWA,
  storeLinksFor,
  type AppPlatform,
  type StoreLink,
} from "./platform"
import { appPromoSurface, type AppPromoSurface } from "./visibility"

interface PromoEnv {
  mounted: boolean
  platform: AppPlatform
  standalone: boolean
}

const UNMOUNTED: PromoEnv = { mounted: false, platform: "other", standalone: false }

export interface AppPromo {
  /** Which surface should render right now. */
  surface: AppPromoSurface
  /** The detected store platform (drives which badges the card shows). */
  platform: AppPlatform
  /** The store link(s) to offer this platform - already narrowed, render them as-is. */
  links: StoreLink[]
  /** Dismiss the promo permanently, on every surface. */
  dismiss: () => void
}

export function useAppPromo(): AppPromo {
  const [env, setEnv] = React.useState<PromoEnv>(UNMOUNTED)

  React.useEffect(() => {
    // Web-only by construction: you do not advertise the app inside the app. On native this leaves `env`
    // at UNMOUNTED forever, so `surface` stays "none" and neither surface ever renders.
    if (Platform.OS !== "web" || typeof navigator === "undefined") return

    setEnv({
      mounted: true,
      platform: detectAppPlatform({
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        maxTouchPoints: navigator.maxTouchPoints,
      }),
      standalone: isStandalonePWA(typeof window !== "undefined" ? window : undefined),
    })
  }, [])

  const layoutMode = useLayoutMode()
  const dismissed = useAppPromoStore((s) => s.dismissed)
  const dismiss = useAppPromoStore((s) => s.dismiss)

  const surface = appPromoSurface({
    mounted: env.mounted,
    layoutMode,
    platform: env.platform,
    dismissed,
    standalone: env.standalone,
  })

  const links = React.useMemo(() => storeLinksFor(env.platform), [env.platform])

  return { surface, platform: env.platform, links, dismiss }
}
