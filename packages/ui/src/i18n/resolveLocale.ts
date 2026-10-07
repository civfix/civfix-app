import { SupportedLocaleSchema, type SupportedLocale } from "@civfix/shared"

export const supportedLocales: ReadonlyArray<{ code: SupportedLocale; nativeName: string }> = [
  { code: "en", nativeName: "English" },
  { code: "es", nativeName: "Español" },
  { code: "de", nativeName: "Deutsch" },
  { code: "ko", nativeName: "한국어" },
]

const SUPPORTED = new Set<string>(SupportedLocaleSchema.options)

export const FALLBACK_LOCALE: SupportedLocale = "en"

export function resolveLocale(tag?: string | null): SupportedLocale {
  if (!tag) return FALLBACK_LOCALE
  const base = tag.split(/[-_]/)[0]?.toLowerCase() ?? ""
  return SUPPORTED.has(base) ? (base as SupportedLocale) : FALLBACK_LOCALE
}
