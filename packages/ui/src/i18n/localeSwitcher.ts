/**
 * Moves an i18next instance to a locale whose catalogs may not be in memory yet (web fetches every
 * non-English locale as a chunk). Catalogs are added BEFORE `changeLanguage`, so no key ever resolves
 * against a half-loaded locale, and the instance stays on its current language until they arrive.
 */
import type { i18n as I18nInstance, ResourceLanguage } from "i18next"
import type { SupportedLocale } from "@civfix/shared"

export type CatalogLoader = (lng: SupportedLocale) => Promise<ResourceLanguage>

/** True once every namespace of `lng` is in the store: catalogs are only ever added whole. */
export function hasCatalog(instance: I18nInstance, lng: SupportedLocale): boolean {
  return instance.getDataByLanguage(lng) !== undefined
}

function addCatalog(instance: I18nInstance, lng: SupportedLocale, catalog: ResourceLanguage): void {
  for (const [ns, bundle] of Object.entries(catalog)) {
    instance.addResourceBundle(lng, ns, bundle)
  }
}

/**
 * Resolves `true` when `lng` became (or already was) the active language, `false` when a newer request
 * superseded it or its catalog failed to load. A failure is not cached, so asking again refetches; the
 * instance keeps its current, fully loaded language meanwhile, which is the whole fallback.
 */
export type SwitchLocale = (lng: SupportedLocale) => Promise<boolean>

export function makeLocaleSwitcher(instance: I18nInstance, load: CatalogLoader): SwitchLocale {
  let requested: SupportedLocale | null = null

  return (lng) => {
    requested = lng
    if (hasCatalog(instance, lng)) {
      // Synchronous when the catalog is present, so a bundled locale switches exactly as before.
      if (instance.language !== lng) void instance.changeLanguage(lng)
      return Promise.resolve(true)
    }
    return load(lng).then(
      (catalog) => {
        if (!hasCatalog(instance, lng)) addCatalog(instance, lng, catalog)
        if (requested !== lng) return false
        if (instance.language !== lng) void instance.changeLanguage(lng)
        return true
      },
      () => false,
    )
  }
}
