import type { AppConfigResponse } from "@civfix/contract"

export type AppPlatform = "ios" | "android"

export type ForceUpdateDecision = { blocked: false } | { blocked: true; storeUrl: string | null }

export function isBelowMinimum(_own: string | null | undefined, _minimum: string | null): boolean {
  throw new Error("not implemented")
}

export function usableStoreUrl(_url: string | null): string | null {
  throw new Error("not implemented")
}

export function forceUpdateFor(
  _config: AppConfigResponse | undefined,
  _platform: AppPlatform,
  _ownVersion: string | null | undefined,
): ForceUpdateDecision {
  throw new Error("not implemented")
}
