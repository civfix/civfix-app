export { I18nProvider } from "./I18nProvider"
export type { I18nProviderProps } from "./I18nProvider"

export { useT } from "./useT"
// Re-exported because react-i18next is a dependency of @civfix/ui, not of the apps.
export { Trans } from "react-i18next"
export { useLocale } from "./LocaleContext"
export type { LocaleContextValue } from "./LocaleContext"

export { useRelativeTime } from "./useRelativeTime"
export type { UseRelativeTime } from "./useRelativeTime"

export { useViewerTimeZone, viewerTimeZone } from "./useViewerTimeZone"

export { useEventWhen } from "./useEventWhen"
export type { EventWhen } from "./useEventWhen"

export { resolveLocale, supportedLocales, FALLBACK_LOCALE } from "./resolveLocale"
export { resolveActiveLocale } from "./resolveActiveLocale"
export type { LocaleSources } from "./resolveActiveLocale"
export { createI18n, defaultNS } from "./config"

export type { SupportedLocale } from "@civfix/shared"
