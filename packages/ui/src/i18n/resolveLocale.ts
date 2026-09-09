/**
 * Locale resolution: clamp an arbitrary BCP-47 tag to one of the four supported app locales.
 *
 * The host (web/mobile) detects a device/browser locale (e.g. `"de-AT"`, `"ko-KR"`, `"es-419"`,
 * `"pt-BR"`) and passes it through here before handing the result to <I18nProvider>. We take the base
 * language subtag (before the first `-`/`_`), lowercase it, and accept it only if it is one of
 * {en,es,de,ko}; anything else falls back to `"en"`. This is the single clamp used everywhere so the
 * provider never has to reason about region subtags.
 */
import { LocaleEnum, type SupportedLocale } from "@civfix/shared"

/** The supported locales, in display order, with their native names (for the language switcher). */
export const supportedLocales: ReadonlyArray<{ code: SupportedLocale; nativeName: string }> = [
  { code: "en", nativeName: "English" },
  { code: "es", nativeName: "Español" },
  { code: "de", nativeName: "Deutsch" },
  { code: "ko", nativeName: "한국어" },
]

/** Fast membership set derived from the contract enum, so this stays in lock-step with `SupportedLocale`. */
const SUPPORTED = new Set<string>(LocaleEnum.options)

/** The source-of-truth + fallback locale. */
export const FALLBACK_LOCALE: SupportedLocale = "en"

/**
 * Clamp an arbitrary BCP-47 tag (or undefined) to a supported locale. Takes the base language subtag and
 * returns it when supported, else `"en"`. Examples: `"de-AT"→"de"`, `"ko_KR"→"ko"`, `"es-419"→"es"`,
 * `"pt-BR"→"en"`, `undefined→"en"`.
 */
export function resolveLocale(tag?: string | null): SupportedLocale {
  if (!tag) return FALLBACK_LOCALE
  const base = tag.split(/[-_]/)[0]?.toLowerCase() ?? ""
  return SUPPORTED.has(base) ? (base as SupportedLocale) : FALLBACK_LOCALE
}
