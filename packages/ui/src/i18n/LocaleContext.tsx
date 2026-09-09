/**
 * LocaleContext + useLocale — the host-neutral seam for the active locale + a setter.
 *
 * The shared layer (e.g. LanguageSettingsBody) reads the active locale and calls `setLocale(code)`
 * without knowing HOW the host persists it: web writes localStorage + PATCHes /me, mobile writes MMKV +
 * PATCHes /me. The host injects `setLocale` via <I18nProvider setLocale={…}>; `locale` mirrors the prop
 * the host resolved. When no setter is supplied (read-only contexts), `setLocale` is a no-op.
 *
 * The provider that drives i18next lives in I18nProvider.tsx; this context only carries the
 * locale/setLocale pair the shared bodies consume.
 */
import { createContext, useContext } from "react"
import type { SupportedLocale } from "@civfix/shared"

export interface LocaleContextValue {
  /** The active app locale (mirrors the resolved prop the host passed to <I18nProvider>). */
  locale: SupportedLocale
  /**
   * Switch the app locale. Supplied by the host (web/mobile wire persistence + server sync); a no-op
   * when the provider was mounted without a setter.
   */
  setLocale: (code: SupportedLocale) => void
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export const LocaleProvider = LocaleContext.Provider

/**
 * Read the active locale + setter. Outside an <I18nProvider> it degrades to `{ locale: "en", setLocale:
 * noop }` so a shared body never throws when rendered in isolation (e.g. a snapshot test without the host
 * provider).
 */
export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (ctx) return ctx
  return { locale: "en", setLocale: () => {} }
}
