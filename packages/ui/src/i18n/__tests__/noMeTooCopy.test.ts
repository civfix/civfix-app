import { readdirSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { loadCatalog } from "../bundledCatalogs"
import { createI18n } from "../config"
import { makeLocaleSwitcher } from "../localeSwitcher"

const LOCALES = ["en", "es", "de", "ko"] as const
const ME_TOO = [/me too/i, /yo también/i, /ich auch/i, /저도요/]

function stringsSayingMeToo(lng: string): string[] {
  const dir = new URL(`../locales/${lng}/`, import.meta.url)
  const hits: string[] = []
  const walk = (value: unknown, path: string) => {
    if (typeof value === "string") {
      if (ME_TOO.some((re) => re.test(value))) hits.push(`${path}: ${value}`)
    } else if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`)
    }
  }
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".json"))) {
    walk(JSON.parse(readFileSync(new URL(file, dir), "utf8")), `${lng}/${file.replace(/\.json$/, "")}`)
  }
  return hits
}

async function i18nFor(lng: (typeof LOCALES)[number]) {
  const i18n = createI18n(lng)
  expect(await makeLocaleSwitcher(i18n, loadCatalog)(lng)).toBe(true)
  return i18n
}

describe("GH#203 copy", () => {
  it.each(LOCALES)("T6: no %s string says Me too", (lng) => {
    expect(stringsSayingMeToo(lng)).toEqual([])
  })

  it.each(["es", "de", "ko"] as const)("T6: the counts resolve in %s, translated", async (lng) => {
    const en = await i18nFor("en")
    const other = await i18nFor(lng)
    for (const key of ["report-row:confirm_count", "report-row:fixed_count"]) {
      for (const count of [1, 3]) {
        const translated = other.t(key, { count })
        expect(translated, `${lng} ${key} ${count}`).not.toBe("")
        expect(translated, `${lng} ${key} ${count}`).not.toBe(en.t(key, { count }))
      }
    }
  })
})
