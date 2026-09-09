/**
 * The active-locale PRIORITY CHAIN (i18n design §2.5), shared by both hosts.
 *
 * The order is policy, not plumbing - "a local switch immediately overrides the server" - and it used to
 * be implemented once per host, so it could drift. Only the two LEAF reads are platform-specific
 * (localStorage + navigator vs MMKV + expo-localization); the hosts inject those and this owns the order:
 *
 *   1. the user's EXPLICIT stored choice (highest, so a manual switch survives restarts and offline),
 *   2. the authed user's server `locale` (cross-device source of truth; seeds a fresh authed install),
 *   3. the platform (browser / device / OS) language,
 *   4. `"en"`.
 *
 * Every candidate is clamped through `resolveLocale` (base language subtag -> one of {en,es,de,ko}).
 */
import { resolveLocale } from "./resolveLocale"
import type { SupportedLocale } from "@civfix/shared"

/** The two platform-specific leaf reads. Both must be total: return null/undefined instead of throwing. */
export interface LocaleSources {
  /** The user's explicit stored choice (web: localStorage, mobile: MMKV), or null if none/unavailable. */
  readStored: () => string | null | undefined
  /** The platform's preferred language tag (navigator / expo-localization), or null if unavailable. */
  platformLocale: () => string | null | undefined
}

/**
 * Resolve the active locale from the four sources in priority order, clamped to a supported locale.
 * `userLocale` is the authed user's server `user.locale` (null when signed out / not yet loaded).
 */
export function resolveActiveLocale(
  sources: LocaleSources,
  userLocale?: string | null,
): SupportedLocale {
  const stored = sources.readStored()
  if (stored) return resolveLocale(stored)
  if (userLocale) return resolveLocale(userLocale)
  return resolveLocale(sources.platformLocale())
}
