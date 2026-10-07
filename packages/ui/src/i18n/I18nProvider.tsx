/**
 * The host detects and resolves the locale and passes it in: the provider never reads `navigator` or a
 * native module, either of which would break the other platform. One i18next instance serves every
 * shared body and host screen.
 *
 * The context's `locale` is the APPLIED one: while a requested locale's catalog is still loading (web),
 * strings stay in the current language, so dates, numbers and `lang` must stay in it too.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { I18nextProvider } from "react-i18next"
import type { SupportedLocale } from "@civfix/shared"
import { loadCatalog } from "./bundledCatalogs"
import { createI18n } from "./config"
import { LocaleProvider, type LocaleContextValue } from "./LocaleContext"
import { makeLocaleSwitcher } from "./localeSwitcher"
import { resolveLocale } from "./resolveLocale"

export interface I18nProviderProps {
  locale: SupportedLocale
  setLocale?: (code: SupportedLocale) => void
  children: React.ReactNode
}

export function I18nProvider({ locale, setLocale, children }: I18nProviderProps) {
  const [instance] = useState(() => createI18n(locale))
  const [switchLocale] = useState(() => makeLocaleSwitcher(instance, loadCatalog))

  const requestedRef = useRef(locale)
  useEffect(() => {
    requestedRef.current = locale
    void switchLocale(locale)
  }, [switchLocale, locale])

  // Read from the instance, not the prop, so the context flips in the same render batch as the strings
  // (react-i18next re-renders on the same `languageChanged` event).
  const subscribe = useCallback(
    (onChange: () => void) => {
      instance.on("languageChanged", onChange)
      return () => instance.off("languageChanged", onChange)
    },
    [instance],
  )
  const readLanguage = useCallback(() => instance.language, [instance])
  const appliedLocale = resolveLocale(useSyncExternalStore(subscribe, readLanguage, readLanguage))

  // Choosing the locale that is already requested leaves the prop unchanged, so the effect cannot retry a
  // catalog that failed to load; the explicit choice retries it here instead.
  const requestLocale = useCallback(
    (code: SupportedLocale) => {
      setLocale?.(code)
      if (code === requestedRef.current) void switchLocale(code)
    },
    [setLocale, switchLocale],
  )

  const value = useMemo<LocaleContextValue>(
    () => ({ locale: appliedLocale, setLocale: requestLocale }),
    [appliedLocale, requestLocale],
  )

  return (
    <I18nextProvider i18n={instance}>
      <LocaleProvider value={value}>{children}</LocaleProvider>
    </I18nextProvider>
  )
}
