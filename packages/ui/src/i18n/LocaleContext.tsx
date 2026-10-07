/**
 * Shared bodies switch the locale without knowing how the host persists it (web: localStorage, mobile:
 * MMKV, both PUT /me/settings). The i18next instance itself lives in I18nProvider.
 */
import { createContext, useContext } from "react"
import type { SupportedLocale } from "@civfix/shared"

export interface LocaleContextValue {
  locale: SupportedLocale
  setLocale: (code: SupportedLocale) => void
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export const LocaleProvider = LocaleContext.Provider

/** Degrades to English with a no-op setter outside a provider, so a body rendered in isolation never throws. */
export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (ctx) return ctx
  return { locale: "en", setLocale: () => {} }
}
