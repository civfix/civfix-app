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
import { SupportedLocaleSchema, type SupportedLocale } from "@civfix/shared"
import { initialResources } from "./bundledCatalogs"
import { namespaces } from "./catalogs/namespaces"
import { FALLBACK_LOCALE } from "./resolveLocale"

const defaultNS = "common"

/**
 * Starts in `locale` only when its catalogs are bundled; otherwise in the fallback, because a language
 * without catalogs would render English while claiming to be `locale`. I18nProvider loads the rest.
 */
export function createI18n(locale: SupportedLocale = FALLBACK_LOCALE): I18nInstance {
  const instance = i18next.createInstance()
  void instance.use(initReactI18next).init({
    lng: locale in initialResources ? locale : FALLBACK_LOCALE,
    fallbackLng: FALLBACK_LOCALE,
    supportedLngs: SupportedLocaleSchema.options,
    ns: namespaces as unknown as string[],
    defaultNS,
    // A copy, because i18next adds loaded catalogs into the object it is given, and that object is a
    // module singleton shared by every instance.
    resources: { ...initialResources },
    returnNull: false,
    returnEmptyString: true,
    interpolation: { escapeValue: false },
    // A catalog is added before its language is activated, so there is nothing to suspend on, and no
    // <Suspense> boundary exists.
    react: { useSuspense: false },
  })
  return instance
}
