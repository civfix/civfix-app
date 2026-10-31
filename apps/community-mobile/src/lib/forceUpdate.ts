import type { AppConfigResponse } from "@civfix/contract"

export type AppPlatform = "ios" | "android"

export type ForceUpdateDecision = { blocked: false } | { blocked: true; storeUrl: string | null }

// The contract's semver flag format. Anything else, on either side, is unparsable and never blocks.
const VERSION = /^(\d+)\.(\d+)\.(\d+)$/

// Exact, case-sensitive prefixes: a URL from the config only ever opens one of the two stores.
const STORE_URL_PREFIXES = ["https://apps.apple.com/", "https://play.google.com/"] as const

function parseVersion(version: string | null | undefined): [number, number, number] | null {
  const match = typeof version === "string" ? VERSION.exec(version) : null
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null
}

export function isBelowMinimum(own: string | null | undefined, minimum: string | null): boolean {
  const ownParts = parseVersion(own)
  const minimumParts = parseVersion(minimum)
  if (!ownParts || !minimumParts) return false
  const [ownMajor, ownMinor, ownPatch] = ownParts
  const [minMajor, minMinor, minPatch] = minimumParts
  if (ownMajor !== minMajor) return ownMajor < minMajor
  if (ownMinor !== minMinor) return ownMinor < minMinor
  return ownPatch < minPatch
}

export function usableStoreUrl(url: string | null): string | null {
  if (url === null) return null
  return STORE_URL_PREFIXES.some((prefix) => url.startsWith(prefix)) ? url : null
}

export function forceUpdateFor(
  config: AppConfigResponse | undefined,
  platform: AppPlatform,
  ownVersion: string | null | undefined,
): ForceUpdateDecision {
  if (!config || !isBelowMinimum(ownVersion, config.minAppVersion[platform]))
    return { blocked: false }
  return { blocked: true, storeUrl: usableStoreUrl(config.storeUrl[platform]) }
}
