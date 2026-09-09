/**
 * `createI18n()` — builds a configured i18next instance for the civfix app.
 *
 * Pure JS + React-free here (the React glue is in I18nProvider/useT), so the SAME instance config runs
 * under react-native-web (web) and React Native (mobile). Key choices:
 *   - `ns` = every catalog namespace (from the generated resources.ts), `defaultNS: "common"`.
 *   - `fallbackLng: "en"` — the source of truth; any missing key/locale falls back to English.
 *   - `returnNull: false` + `returnEmptyString: false` — so an empty stub value ("") is treated as
 *     "missing" and falls back to en (or the key), which is exactly what the 60 empty namespace stubs
 *     need until they are authored.
 *   - `interpolation.escapeValue: false` — React/RN already escape; i18next must not HTML-escape.
 *   - `supportedLngs` clamps to the four app locales (the host pre-clamps via resolveLocale anyway).
 *
 * The instance is created once per provider mount; the host drives the active language with
 * `instance.changeLanguage(locale)` (I18nProvider does this on mount + on locale prop change).
 */
import i18next, { type i18n as I18nInstance } from "i18next"
import { initReactI18next } from "react-i18next"
import { LocaleEnum, type SupportedLocale } from "@civfix/shared"
import { namespaces, resources } from "./resources"
import { FALLBACK_LOCALE } from "./resolveLocale"

/** The default namespace (the genuinely-shared strings: Continue/Back/Cancel/…). */
export const defaultNS = "common"

/**
 * Build a fresh, initialized i18next instance seeded at `locale`. The host passes a pre-clamped
 * `SupportedLocale`; `changeLanguage` is later called by the provider when the locale prop changes.
 */
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
    returnEmptyString: false,
    interpolation: { escapeValue: false },
    // RN/web have no <Suspense> wiring here; resources are bundled (no async backend), so disable it.
    react: { useSuspense: false },
  })
  return instance
}
