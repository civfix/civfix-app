/**
 * Web ships English in the root bundle and fetches every other locale as its own chunk: the other three
 * locales were most of the root layout chunk, downloaded by every page for every visitor.
 */
import type { Resource, ResourceLanguage } from "i18next"
import type { SupportedLocale } from "@civfix/shared"
import en from "./catalogs/en"
import { lazyCatalogs } from "./catalogs/lazy"

export const initialResources: Resource = { en }

export function loadCatalog(lng: SupportedLocale): Promise<ResourceLanguage> {
  if (lng === "en") return Promise.resolve(en)
  return lazyCatalogs[lng]().then((mod) => mod.default)
}
