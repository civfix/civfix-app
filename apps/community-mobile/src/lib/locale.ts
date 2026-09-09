/**
 * Locale resolution for the mobile host.
 *
 * The shared <I18nProvider> never reads the device locale itself (that would break the web build) — the
 * host resolves the active locale and injects it as a prop. This module is that resolver.
 *
 * Resolution ORDER is not owned here: the shared `resolveActiveLocale` (@civfix/ui/i18n) holds the one
 * priority chain both hosts run - explicit stored choice → authed `user.locale` → platform language →
 * 'en', each clamped through `resolveLocale` (base language subtag → one of {en,es,de,ko}). This module
 * supplies the two NATIVE leaf reads it needs:
 *   - the explicit in-app choice persisted to MMKV (`civfix.locale`), which survives restarts/offline,
 *   - the device/OS language via expo-localization `getLocales()[0].languageCode`.
 *
 * `getLocales()` touches a native module, so it is guarded — on a non-native runtime (web bundle / static
 * export eval) it degrades to the fallback rather than throwing.
 */
import { getLocales } from "expo-localization"
import {
  resolveActiveLocale as resolveActiveLocaleFrom,
  resolveLocale,
  type LocaleSources,
  type SupportedLocale,
} from "@civfix/ui/i18n"
import type { UserDTO } from "@civfix/shared"
import { storage } from "@/lib/mmkv"
import { LOCALE_KEY } from "@/lib/mmkv-keys"

/** Read the explicit MMKV language choice, if any (tolerating absent/native-unavailable storage). */
export function readStoredLocale(): SupportedLocale | null {
  try {
    const raw = storage.getString(LOCALE_KEY)
    if (!raw) return null
    // Clamp defensively: an old/garbage value resolves to a supported locale or 'en'.
    return resolveLocale(raw)
  } catch {
    return null
  }
}

/** The device/OS preferred language code (e.g. "de"), or undefined if the native module is unavailable. */
function deviceLanguageCode(): string | undefined {
  try {
    return getLocales()[0]?.languageCode ?? undefined
  } catch {
    return undefined
  }
}

/** The two NATIVE leaf reads the shared priority chain resolves through. */
const nativeLocaleSources: LocaleSources = {
  readStored: readStoredLocale,
  platformLocale: deviceLanguageCode,
}

/**
 * Resolve the active app locale from (explicit choice → authed user → device → 'en'), clamped to a
 * supported locale. `user` is the authed user (or null when signed out / still hydrating). Only the
 * `locale` field is read, so callers that already hold just that value may pass `{ locale }` and memoize
 * on it rather than on the whole user object.
 */
export function resolveActiveLocale(user: Pick<UserDTO, "locale"> | null): SupportedLocale {
  return resolveActiveLocaleFrom(nativeLocaleSources, user?.locale ?? null)
}
