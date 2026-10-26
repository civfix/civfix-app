import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const read = (...path: string[]) => readFileSync(join(__dirname, "..", "..", ...path), "utf8")

const COMPONENTS = {
  LegalUpdateGate: read("bodies", "LegalUpdateGate.tsx"),
  LegalNoticeBanner: read("bodies", "LegalNoticeBanner.tsx"),
}

const LOCALES = ["en", "de", "es", "ko"] as const

function catalog(locale: (typeof LOCALES)[number]): Record<string, unknown> {
  return JSON.parse(read("i18n", "locales", locale, "legal.json")) as Record<string, unknown>
}

function lookup(tree: Record<string, unknown>, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => {
    return typeof node === "object" && node !== null ? (node as Record<string, unknown>)[part] : undefined
  }, tree)
}

/** Every key a component can ask for: its literal `t("…")` calls and the keys its per-document tables name. */
function keysOf(source: string): string[] {
  const calls = [...source.matchAll(/\bt\(\s*"([^"]+)"/g)].map((match) => match[1] ?? "")
  const tables = [...source.matchAll(/"((?:update|notice)\.[a-z_.]+)"/g)].map((match) => match[1] ?? "")
  return [...new Set([...calls, ...tables])].sort()
}

describe("the legal update components' copy", () => {
  it.each(Object.entries(COMPONENTS))(
    "T19: %s reads every visible string from legal.json and has no literal copy",
    (_name, source) => {
      expect([...source.matchAll(/useT\(\s*"([^"]+)"/g)].map((match) => match[1])).toEqual(["legal"])
      expect(source).not.toMatch(/>[^<>{}\n]*[A-Za-z][^<>{}\n]*<\//)
      expect(source).not.toMatch(/\b(?:label|accessibilityLabel|aria-label|title|placeholder)="/)
      const keys = keysOf(source)
      expect(keys.length).toBeGreaterThan(0)
      const en = catalog("en")
      expect(keys.filter((key) => typeof lookup(en, key) !== "string")).toEqual([])
    },
  )

  it.each(LOCALES)("T35: every key the components use is in the %s catalog", (locale) => {
    const tree = catalog(locale)
    const keys = Object.values(COMPONENTS).flatMap(keysOf)
    expect(keys.length).toBeGreaterThan(0)
    const missing = keys.filter((key) => {
      const value = lookup(tree, key)
      return typeof value !== "string" || value.length === 0
    })
    expect(missing).toEqual([])
  })
})

describe("the shell", () => {
  it("T34: AppShell renders LegalNoticeBanner", () => {
    const shell = read("shell", "AppShell.tsx")
    expect(shell).toMatch(/import \{ LegalNoticeBanner \} from "\.\.\/bodies\/LegalNoticeBanner"/)
    expect(shell).toMatch(/<LegalNoticeBanner \/>/)
  })
})
