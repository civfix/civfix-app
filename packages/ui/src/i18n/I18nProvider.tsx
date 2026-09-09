/**
 * <I18nProvider> — the single i18n provider the host mounts high in the tree (wrapping AppShell), so
 * every shared body + every host-local screen shares ONE i18next instance.
 *
 * It wraps:
 *   - <I18nextProvider i18n={instance}> — so `useTranslation`/`useT` resolve against this instance.
 *   - <LocaleProvider value={{ locale, setLocale }}> — the host-neutral locale seam the shared bodies
 *     (e.g. LanguageSettingsBody) consume.
 *
 * The host DETECTS + RESOLVES the locale (device/browser/user/storage) and passes it as the `locale`
 * prop (the provider never reads `navigator`/native modules — that would break the other platform). The
 * instance is created ONCE (useState initializer); `changeLanguage(locale)` runs on mount and whenever
 * the `locale` prop changes. `setLocale` (optional) is the host's persistence+sync action.
 */
import React, { useEffect, useMemo, useState } from "react"
import { I18nextProvider } from "react-i18next"
import type { SupportedLocale } from "@civfix/shared"
import { createI18n } from "./config"
import { LocaleProvider, type LocaleContextValue } from "./LocaleContext"

export interface I18nProviderProps {
  /** The active, already-resolved (clamped) app locale. The host injects it. */
  locale: SupportedLocale
  /**
   * Switch the locale (write storage, change the language, PATCH /me when authed). Wired by the host;
   * the shared LanguageSettingsBody calls it. Optional — read-only mounts omit it.
   */
  setLocale?: (code: SupportedLocale) => void
  children: React.ReactNode
}

export function I18nProvider({ locale, setLocale, children }: I18nProviderProps) {
  // Create the instance exactly once, seeded at the initial locale (later changes go via changeLanguage).
  const [instance] = useState(() => createI18n(locale))

  // Keep i18next's active language in lock-step with the prop (mount + every change).
  useEffect(() => {
    if (instance.language !== locale) void instance.changeLanguage(locale)
  }, [instance, locale])

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale: setLocale ?? (() => {}) }),
    [locale, setLocale],
  )

  return (
    <I18nextProvider i18n={instance}>
      <LocaleProvider value={value}>{children}</LocaleProvider>
    </I18nextProvider>
  )
}
