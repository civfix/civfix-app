// Accept only a non-empty string: Expo bakes a null `extra` value as `{}`, which `??` would not replace.

export const DEV_API_URL = "http://localhost:8080"
export const STAGING_API_URL = "https://api.civfix.dev"
export const PROD_API_URL = "https://api.civfix.org"

export function resolveApiUrl(configured: unknown, isDev: boolean, isBetaInstall: boolean): string {
  if (typeof configured === "string" && configured.trim() !== "") return configured.trim()
  if (isDev) return DEV_API_URL
  return isBetaInstall ? STAGING_API_URL : PROD_API_URL
}
