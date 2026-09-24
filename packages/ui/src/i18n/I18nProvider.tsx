/**
 * The host detects and resolves the locale and passes it in: the provider never reads `navigator` or a
 * native module, either of which would break the other platform. One i18next instance serves every
 * shared body and host screen.
 */
import React, { useEffect, useMemo, useState } from "react"
import { I18nextProvider } from "react-i18next"
import type { SupportedLocale } from "@civfix/shared"
import { createI18n } from "./config"
import { LocaleProvider, type LocaleContextValue } from "./LocaleContext"

export interface I18nProviderProps {
  locale: SupportedLocale
  setLocale?: (code: SupportedLocale) => void
  children: React.ReactNode
}

export function I18nProvider({ locale, setLocale, children }: I18nProviderProps) {
  const [instance] = useState(() => createI18n(locale))

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
