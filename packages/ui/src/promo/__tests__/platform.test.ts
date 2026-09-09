import { describe, expect, test } from "vitest"

import { detectAppPlatform, isStandalonePWA, storeLinksFor } from "../platform"

/**
 * Real-world user-agent strings. The iPadOS 13+ case is the one that silently breaks naive UA
 * sniffing: iPadOS reports a DESKTOP Safari UA (literally "Macintosh; Intel Mac OS X"), identical to
 * a real Mac. Only `maxTouchPoints` distinguishes them, which is why the probe carries it.
 */
const UA = {
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  ipod: "Mozilla/5.0 (iPod touch; CPU iPhone OS 15_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1",
  ipadLegacy:
    "Mozilla/5.0 (iPad; CPU OS 12_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1",
  desktopSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  androidPhone:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  androidTablet:
    "Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  windows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
} as const

describe("detectAppPlatform", () => {
  test("detects an iPhone as ios", () => {
    expect(detectAppPlatform({ userAgent: UA.iphone })).toBe("ios")
  })

  test("detects an iPod touch as ios", () => {
    expect(detectAppPlatform({ userAgent: UA.ipod })).toBe("ios")
  })

  test("detects a legacy iPad user agent as ipados", () => {
    expect(detectAppPlatform({ userAgent: UA.ipadLegacy })).toBe("ipados")
  })

  test("detects iPadOS 13+ spoofing a desktop Mac UA as ipados via maxTouchPoints", () => {
    expect(
      detectAppPlatform({
        userAgent: UA.desktopSafari,
        platform: "MacIntel",
        maxTouchPoints: 5,
      }),
    ).toBe("ipados")
  })

  test("detects a real Mac (same UA, no touch points) as other", () => {
    expect(
      detectAppPlatform({
        userAgent: UA.desktopSafari,
        platform: "MacIntel",
        maxTouchPoints: 0,
      }),
    ).toBe("other")
  })

  test("detects an Android phone as android", () => {
    expect(detectAppPlatform({ userAgent: UA.androidPhone })).toBe("android")
  })

  test("detects an Android tablet as android", () => {
    expect(detectAppPlatform({ userAgent: UA.androidTablet })).toBe("android")
  })

  test("detects Windows as other", () => {
    expect(detectAppPlatform({ userAgent: UA.windows })).toBe("other")
  })

  test("treats an empty user agent as other", () => {
    expect(detectAppPlatform({ userAgent: "" })).toBe("other")
  })
})

describe("isStandalonePWA", () => {
  test("is true when the display-mode media query matches", () => {
    const win = {
      matchMedia: (q: string) => ({ matches: q.includes("standalone") }),
      navigator: {},
    }
    expect(isStandalonePWA(win)).toBe(true)
  })

  test("is true on legacy iOS via navigator.standalone", () => {
    const win = {
      matchMedia: () => ({ matches: false }),
      navigator: { standalone: true },
    }
    expect(isStandalonePWA(win)).toBe(true)
  })

  test("is false in a normal browser tab", () => {
    const win = {
      matchMedia: () => ({ matches: false }),
      navigator: { standalone: false },
    }
    expect(isStandalonePWA(win)).toBe(false)
  })

  test("is false when there is no window (static-export prerender)", () => {
    expect(isStandalonePWA(undefined)).toBe(false)
  })
})

describe("storeLinksFor", () => {
  test("desktop offers both stores, App Store first", () => {
    const links = storeLinksFor("other")
    expect(links.map((l) => l.store)).toEqual(["app-store", "google-play"])
  })

  test("iPadOS offers only the App Store", () => {
    const links = storeLinksFor("ipados")
    expect(links.map((l) => l.store)).toEqual(["app-store"])
    expect(links[0]?.href).toBe("https://ios.civfix.org")
  })

  test("iOS offers only the App Store", () => {
    expect(storeLinksFor("ios").map((l) => l.store)).toEqual(["app-store"])
  })

  test("Android offers only Google Play", () => {
    const links = storeLinksFor("android")
    expect(links.map((l) => l.store)).toEqual(["google-play"])
    expect(links[0]?.href).toBe("https://android.civfix.org")
  })

  test("every link carries a badge asset and an i18n label key", () => {
    for (const platform of ["ios", "ipados", "android", "other"] as const) {
      for (const link of storeLinksFor(platform)) {
        expect(link.badgeSrc).toMatch(/^\/brand\/.+\.svg$/)
        expect(link.labelKey).toMatch(/^app_promo\./)
      }
    }
  })
})
