/**
 * The one impure step: read the live `navigator` / `window` once, after mount. Detection waits for an
 * effect because the web app is a Next static export, whose prerendered HTML cannot know the user agent;
 * until then `appPromoSurface` returns "none".
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
  surface: AppPromoSurface
  platform: AppPlatform
  links: StoreLink[]
  dismiss: () => void
}

export function useAppPromo(): AppPromo {
  const [env, setEnv] = React.useState<PromoEnv>(UNMOUNTED)

  React.useEffect(() => {
    // You do not advertise the app inside the app: on native `env` stays UNMOUNTED, so nothing renders.
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
