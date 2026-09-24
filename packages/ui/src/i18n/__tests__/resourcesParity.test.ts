import { readdirSync } from "node:fs"
import { LocaleEnum } from "@civfix/shared"
import { describe, expect, it } from "vitest"
import { initialResources, loadCatalog } from "../bundledCatalogs"
import * as nativeSeam from "../bundledCatalogs.native"
import { lazyCatalogs } from "../catalogs/lazy"
import { namespaces, resources } from "../resources"
import { FALLBACK_LOCALE } from "../resolveLocale"

function namespaceFiles(lng: string): string[] {
  return readdirSync(new URL(`../locales/${lng}/`, import.meta.url))
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.replace(/\.json$/, ""))
    .sort()
}

describe("every locale file is registered in resources.ts", () => {
  it("lists each en/*.json in the namespaces array, and nothing else", () => {
    expect([...namespaces].sort()).toEqual(namespaceFiles("en"))
  })

  it.each(LocaleEnum.options)("bundles every %s namespace under resources", (lng) => {
    const bundled = Object.keys(resources[lng] ?? {}).sort()
    expect(bundled).toEqual(namespaceFiles(lng))
  })
})

describe("the web seam bundles English and lazy-loads every other locale", () => {
  it("starts with English only", () => {
    expect(Object.keys(initialResources)).toEqual([FALLBACK_LOCALE])
    expect(initialResources[FALLBACK_LOCALE]).toBe(resources[FALLBACK_LOCALE])
  })

  it("has a chunk loader for every other locale, and nothing else", () => {
    expect(Object.keys(lazyCatalogs).sort()).toEqual(
      LocaleEnum.options.filter((lng) => lng !== FALLBACK_LOCALE).sort(),
    )
  })

  it.each(LocaleEnum.options)("loads the same %s catalog the static resources carry", async (lng) => {
    expect(await loadCatalog(lng)).toBe(resources[lng])
  })
})

describe("the native seam bundles every locale", () => {
  it("starts with all of them, so mobile never waits on a catalog", () => {
    expect(nativeSeam.initialResources).toBe(resources)
    expect(Object.keys(nativeSeam.initialResources).sort()).toEqual([...LocaleEnum.options].sort())
  })
})
