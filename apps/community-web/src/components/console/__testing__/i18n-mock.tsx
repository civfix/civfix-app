import type { ReactNode } from "react"

export function makeI18nMock() {
  const t = (key: string, options?: Record<string, unknown>) => {
    if (!options) return key
    const values = Object.entries(options)
      .filter(([name]) => name !== "defaultValue")
      .map(([name, value]) => `${name}=${String(value)}`)
    if (values.length === 0) return key
    return `${key}(${values.join(",")})`
  }
  return {
    useT: () => ({ t, i18n: { language: "en", changeLanguage: () => Promise.resolve(t) } }),
    useLocale: () => ({ locale: "en" as const, setLocale: () => {} }),
    useRelativeTime: () => ({
      relative: () => "now",
      weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      justNow: "now",
      units: { minute: "m", hour: "h", day: "d", week: "w" },
    }),
    I18nProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    Trans: ({ children }: { children?: ReactNode }) => <>{children}</>,
    FALLBACK_LOCALE: "en" as const,
    supportedLocales: ["en", "es", "de", "ko"] as const,
    resolveLocale: () => "en" as const,
    resolveActiveLocale: () => "en" as const,
  }
}
