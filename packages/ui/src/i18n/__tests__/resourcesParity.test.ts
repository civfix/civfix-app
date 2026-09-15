import { readdirSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { namespaces, resources } from "../resources"

const LOCALES = ["en", "es", "de", "ko"] as const

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

  it.each(LOCALES)("bundles every %s namespace under resources", (lng) => {
    const bundled = Object.keys(resources[lng] ?? {}).sort()
    expect(bundled).toEqual(namespaceFiles(lng))
  })
})
