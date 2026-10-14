/** Metro bundles every catalog regardless, so native starts with all of them and never loads one. */
import type { Resource, ResourceLanguage } from "i18next"
import type { SupportedLocale } from "@civfix/shared"
import { resources } from "./resources"

export const initialResources: Resource = resources

export function loadCatalog(lng: SupportedLocale): Promise<ResourceLanguage> {
  const catalog = resources[lng]
  return catalog ? Promise.resolve(catalog) : Promise.reject(new Error(`No catalog for ${lng}`))
}
