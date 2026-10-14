/**
 * The active-locale priority chain, shared by both hosts so the policy cannot drift between them; only
 * the two leaf reads are platform-specific and injected:
 *   1. the user's explicit stored choice (so a manual switch survives restarts and offline),
 *   2. the signed-in user's server `locale` (cross-device, and seeds a fresh signed-in install),
 *   3. the platform language,
 *   4. `"en"`.
 */
import { resolveLocale } from "./resolveLocale"
import type { SupportedLocale } from "@civfix/shared"

/** Both reads must be total: return null or undefined instead of throwing. */
export interface LocaleSources {
  readStored: () => string | null | undefined
  platformLocale: () => string | null | undefined
}

export function resolveActiveLocale(
  sources: LocaleSources,
  userLocale?: string | null,
): SupportedLocale {
  const stored = sources.readStored()
  if (stored) return resolveLocale(stored)
  if (userLocale) return resolveLocale(userLocale)
  return resolveLocale(sources.platformLocale())
}
