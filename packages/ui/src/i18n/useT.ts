/**
 * useT(ns?) — the one translation hook every call site uses.
 *
 * A thin wrapper over react-i18next's `useTranslation` so the civfix vocabulary is `useT('report-detail')`
 * etc. (rather than the library name). Pass a namespace to bind `t` to it: `const { t } = useT('profile')`
 * then `t('title')`; or use the cross-namespace `ns:key` form: `t('common:cancel')`. With no argument it
 * binds the default namespace (`common`).
 *
 * Returns `{ t, i18n }` (the same shape react-i18next returns), so call sites also get `i18n` for
 * `i18n.language` / `i18n.changeLanguage` when needed.
 */
import { useTranslation } from "react-i18next"

/** Bind translations, optionally to a namespace. `useT('report-detail').t('comment_count', { count })`. */
export function useT(ns?: string) {
  return useTranslation(ns)
}
