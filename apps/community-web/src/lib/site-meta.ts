export const SITE_NAME = "civfix"
export const PRODUCTION_SITE_URL = "https://civfix.org"
export const STAGING_SITE_URL = "https://civfix.dev"
export const DEFAULT_SITE_URL = PRODUCTION_SITE_URL
export const DEFAULT_TITLE = "civfix"
export const DEFAULT_DESCRIPTION =
  "Report neighborhood issues, browse the map, and join local cleanups. civfix connects residents and city services."

export const SITE_LOCALE = "en_US"

export const BRAND_IMAGE_PATH = "/og.png"
export const BRAND_IMAGE_WIDTH = 1200
export const BRAND_IMAGE_HEIGHT = 630
export const BRAND_IMAGE_TYPE = "image/png"

export const ICON_PATH = "/favicon.svg"
export const ICON_TYPE = "image/svg+xml"
export const APPLE_TOUCH_ICON_PATH = "/apple-touch-icon.png"
export const APPLE_TOUCH_ICON_SIZE = 180
export const APPLE_TOUCH_ICON_SIZES = `${APPLE_TOUCH_ICON_SIZE}x${APPLE_TOUCH_ICON_SIZE}`

export const PRODUCTION_HOSTNAMES: readonly string[] = [
  "civfix.org",
  "www.civfix.org",
  "civfix-web.pages.dev",
]

export const STAGING_HOSTNAMES: readonly string[] = [
  "civfix.dev",
  "www.civfix.dev",
  "dev.civfix-web.pages.dev",
]

export function canonicalSiteOriginFor(hostname: string): string | null {
  if (PRODUCTION_HOSTNAMES.includes(hostname)) return PRODUCTION_SITE_URL
  if (STAGING_HOSTNAMES.includes(hostname)) return STAGING_SITE_URL
  return null
}

export function normalizeSiteUrl(value?: string | null): string {
  const raw = value?.trim()
  if (!raw) return DEFAULT_SITE_URL
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return DEFAULT_SITE_URL
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return DEFAULT_SITE_URL
  return parsed.origin
}

export function resolveSiteOrigin(requestUrl: string | null | undefined): string {
  if (!requestUrl) return DEFAULT_SITE_URL
  let parsed: URL
  try {
    parsed = new URL(requestUrl)
  } catch {
    return DEFAULT_SITE_URL
  }
  if (parsed.protocol !== "https:" || parsed.port !== "") return DEFAULT_SITE_URL
  return canonicalSiteOriginFor(parsed.hostname) ?? DEFAULT_SITE_URL
}
