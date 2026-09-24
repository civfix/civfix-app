/**
 * `returnEmptyString: true`: an empty value is a deliberate empty sentence fragment (Korean word order
 * moves the text of a `*_pre`/`*_lead` half into the other half), so it must render as "" rather than
 * fall back to the English fragment. `i18n:check` rejects any empty value outside its allowlist, so an
 * unauthored stub cannot hide behind this.
 *
 * `escapeValue: false`: React and RN already escape, so i18next must not HTML-escape.
 */
import i18next, { type i18n as I18nInstance } from "i18next"
import { initReactI18next } from "react-i18next"
import { LocaleEnum, type SupportedLocale } from "@civfix/shared"
import { namespaces, resources } from "./resources"
import { FALLBACK_LOCALE } from "./resolveLocale"

const defaultNS = "common"

export function createI18n(locale: SupportedLocale = FALLBACK_LOCALE): I18nInstance {
  const instance = i18next.createInstance()
  void instance.use(initReactI18next).init({
    lng: locale,
    fallbackLng: FALLBACK_LOCALE,
    supportedLngs: LocaleEnum.options,
    ns: namespaces as unknown as string[],
    defaultNS,
    resources,
    returnNull: false,
    returnEmptyString: true,
    interpolation: { escapeValue: false },
    // Resources are bundled, so there is nothing to suspend on, and no <Suspense> boundary exists.
    react: { useSuspense: false },
  })
  return instance
}
