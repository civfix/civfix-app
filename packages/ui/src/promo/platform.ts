/**
 * Pure by design: every function takes the globals it needs as arguments, so the module tests under node
 * and the static-export prerender never touches a missing `navigator` or `window`.
 */

export type AppPlatform = "ios" | "ipados" | "android" | "other"

export interface PlatformProbe {
  userAgent: string
  platform?: string
  maxTouchPoints?: number
}

export function detectAppPlatform({ userAgent, platform, maxTouchPoints = 0 }: PlatformProbe): AppPlatform {
  // iPhone / iPod first: their UA also contains "like Mac OS X", so a Mac check would false-positive.
  if (/iPhone|iPod/.test(userAgent)) return "ios"

  if (/iPad/.test(userAgent)) return "ipados"

  if (/Android/.test(userAgent)) return "android"

  // iPadOS 13+ requests desktop sites by default and reports a UA byte-identical to desktop Safari on a
  // Mac. The ONLY practical distinguisher is touch: no Mac reports maxTouchPoints > 1, every iPad does.
  const looksMac = platform === "MacIntel" || /Macintosh/.test(userAgent)
  if (looksMac && maxTouchPoints > 1) return "ipados"

  return "other"
}

export type AppStore = "app-store" | "google-play"

export interface StoreLink {
  store: AppStore
  href: string
  badgeSrc: string
  labelKey: string
}

const APP_STORE: StoreLink = {
  store: "app-store",
  href: "https://ios.civfix.org",
  badgeSrc: "/brand/app-store-badge.svg",
  labelKey: "app_promo.badge_app_store",
}

const GOOGLE_PLAY: StoreLink = {
  store: "google-play",
  href: "https://android.civfix.org",
  badgeSrc: "/brand/google-play-badge.svg",
  labelKey: "app_promo.badge_google_play",
}

/** Desktop (`other`) gets both stores: a desktop visitor might carry either phone. */
export function storeLinksFor(platform: AppPlatform): StoreLink[] {
  switch (platform) {
    case "ios":
    case "ipados":
      return [APP_STORE]
    case "android":
      return [GOOGLE_PLAY]
    case "other":
      return [APP_STORE, GOOGLE_PLAY]
  }
}

/**
 * `navigator` is `unknown` so a real `Navigator` is assignable: `standalone` is a non-standard iOS Safari
 * extension lib.dom does not declare, so no structural type naming it would accept one.
 */
interface StandaloneProbe {
  matchMedia?: (query: string) => { matches: boolean }
  navigator?: unknown
}

/** Covers the standard `display-mode: standalone` query plus the legacy iOS Safari `navigator.standalone` flag. */
export function isStandalonePWA(win: StandaloneProbe | undefined): boolean {
  if (!win) return false
  if (win.matchMedia?.("(display-mode: standalone)").matches) return true
  const nav = win.navigator as { standalone?: unknown } | undefined
  return nav?.standalone === true
}
