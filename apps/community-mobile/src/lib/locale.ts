// The shared <I18nProvider> never reads the device locale itself (that would break the web build), so the
// host resolves it and injects it as a prop.
import { getLocales } from "expo-localization"
import {
  resolveActiveLocale as resolveActiveLocaleFrom,
  resolveLocale,
  type LocaleSources,
  type SupportedLocale,
} from "@civfix/ui/i18n"
import type { UserDTO } from "@civfix/shared"
import { storage } from "@/lib/mmkv"
import { LOCALE_KEY } from "@/lib/mmkvKeys"

function readStoredLocale(): SupportedLocale | null {
  try {
    const raw = storage.getString(LOCALE_KEY)
    if (!raw) return null
    return resolveLocale(raw)
  } catch {
    return null
  }
}

function deviceLanguageCode(): string | undefined {
  try {
    return getLocales()[0]?.languageCode ?? undefined
  } catch {
    return undefined
  }
}

const nativeLocaleSources: LocaleSources = {
  readStored: readStoredLocale,
  platformLocale: deviceLanguageCode,
}

export function resolveActiveLocale(user: Pick<UserDTO, "locale"> | null): SupportedLocale {
  return resolveActiveLocaleFrom(nativeLocaleSources, user?.locale ?? null)
}
