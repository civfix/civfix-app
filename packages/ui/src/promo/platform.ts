/**
 * Device/platform detection for the native-app download promo (see
 * docs/superpowers/specs/2026-07-18-web-app-download-promo-design.md).
 *
 * PURE by design: every function takes what it needs as an argument rather than reaching for
 * `navigator` / `window`, so the whole module unit-tests under the plain node vitest environment and the
 * static-export prerender can never trip over a missing global. The callers (use-app-promo) read the
 * live globals once, after mount, and pass them in.
 */

/** The store platform we can send this visitor to, or `other` when there is no native app for it. */
export type AppPlatform = "ios" | "ipados" | "android" | "other"

/** The bits of `navigator` that distinguish the platforms. */
export interface PlatformProbe {
  userAgent: string
  /** `navigator.platform` (legacy but still the reliable iPadOS tell alongside maxTouchPoints). */
  platform?: string
  /** `navigator.maxTouchPoints` - load-bearing for iPadOS 13+, see below. */
  maxTouchPoints?: number
}

export function detectAppPlatform({ userAgent, platform, maxTouchPoints = 0 }: PlatformProbe): AppPlatform {
  // iPhone / iPod first: their UA also contains "like Mac OS X", so a Mac check would false-positive.
  if (/iPhone|iPod/.test(userAgent)) return "ios"

  // Legacy iPad (iPadOS 12 and earlier) still self-identifies honestly.
  if (/iPad/.test(userAgent)) return "ipados"

  if (/Android/.test(userAgent)) return "android"

  // iPadOS 13+ requests desktop sites by default and reports a UA byte-identical to desktop Safari on a
  // Mac. The ONLY practical distinguisher is touch: no Mac reports maxTouchPoints > 1, every iPad does.
  const looksMac = platform === "MacIntel" || /Macintosh/.test(userAgent)
  if (looksMac && maxTouchPoints > 1) return "ipados"

  return "other"
}

/** A store we can link to, with the badge artwork and accessible-label key that go with it. */
export type AppStore = "app-store" | "google-play"

export interface StoreLink {
  store: AppStore
  href: string
  /** Path under `public/`; served by the web app at this absolute path. */
  badgeSrc: string
  /** Key in the `web-common` i18n namespace, used as the link's accessible name. */
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

/**
 * The store links to offer a given platform. Apple devices get only the App Store, Android only Play,
 * and desktop (`other`) gets both - a desktop visitor might carry either phone.
 */
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
 * The bits of `window` that reveal an installed-PWA launch.
 *
 * `navigator` is typed `unknown` (and narrowed at the read below) so a REAL `Navigator` is assignable:
 * `standalone` is a non-standard iOS Safari extension that lib.dom does not declare, so no structural
 * type naming it can accept `Navigator` as an argument.
 */
interface StandaloneProbe {
  matchMedia?: (query: string) => { matches: boolean }
  navigator?: unknown
}

/**
 * True when the page is running as an installed PWA (home-screen launch), where pitching a download is
 * noise - the visitor has already "installed" civfix. Covers the standard `display-mode: standalone`
 * media query plus the legacy iOS Safari `navigator.standalone` flag.
 */
export function isStandalonePWA(win: StandaloneProbe | undefined): boolean {
  if (!win) return false
  if (win.matchMedia?.("(display-mode: standalone)").matches) return true
  const nav = win.navigator as { standalone?: unknown } | undefined
  return nav?.standalone === true
}
