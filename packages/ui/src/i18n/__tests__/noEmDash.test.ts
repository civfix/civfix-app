import { readdirSync, readFileSync } from "node:fs"
import { SupportedLocaleSchema } from "@civfix/contract"
import { describe, expect, it } from "vitest"

const EM_DASH = "—"

function catalogStringsWithEmDash(lng: string): string[] {
  const dir = new URL(`../locales/${lng}/`, import.meta.url)
  const hits: string[] = []
  const walk = (value: unknown, path: string) => {
    if (typeof value === "string") {
      if (value.includes(EM_DASH)) hits.push(path)
    } else if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`)
    }
  }
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".json"))) {
    walk(JSON.parse(readFileSync(new URL(file, dir), "utf8")), `${lng}/${file.replace(/\.json$/, "")}`)
  }
  return hits
}

describe("UI copy punctuation", () => {
  it.each(SupportedLocaleSchema.options)("puts no em dash in any %s string", (lng) => {
    expect(catalogStringsWithEmDash(lng)).toEqual([])
  })
})
