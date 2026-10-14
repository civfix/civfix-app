import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

// The i18n mock renders keys, not copy, so the privacy promise is checked against the real catalogs:
// no string this view can show may tell a link holder whether the token was valid, expired or used.
const TOKEN_STATE_WORDS: Record<string, RegExp> = {
  en: /expired|invalid|not.found|already/i,
  es: /caduc|expir|vencid|inv[aá]lid|no v[aá]lid|no (se )?encontr|ya (estabas|estás|te hab)/i,
  de: /abgelaufen|ungültig|nicht gefunden|bereits|schon/i,
  ko: /만료|유효하지|잘못된|찾을 수 없|이미/,
}

function catalogStrings(locale: string): string[] {
  const url = new URL(`../../../../../packages/ui/src/i18n/locales/${locale}/web-unsubscribe.json`, import.meta.url)
  const walk = (node: unknown): string[] =>
    typeof node === "string" ? [node] : Object.values(node as Record<string, unknown>).flatMap(walk)
  return walk(JSON.parse(readFileSync(url, "utf8")))
}

function renderedKeys(): string[] {
  const source = readFileSync(new URL("./unsubscribe-view.tsx", import.meta.url), "utf8")
  return [...source.matchAll(/\bt\("([^"]+)"\)|i18nKey="([^"]+)"/g)].map((m) => (m[1] ?? m[2])!)
}

describe("UnsubscribeView copy", () => {
  it("renders only keys that exist in the catalog the privacy check reads", () => {
    const en = JSON.parse(
      readFileSync(new URL("../../../../../packages/ui/src/i18n/locales/en/web-unsubscribe.json", import.meta.url), "utf8"),
    ) as Record<string, unknown>
    const keys = renderedKeys()
    expect(keys.length).toBeGreaterThan(0)
    for (const key of keys) {
      const value = key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], en)
      expect(typeof value, key).toBe("string")
    }
  })

  it.each(Object.keys(TOKEN_STATE_WORDS))(
    "says nothing in %s about whether the token was VALID, only whether we could use the link",
    (locale) => {
      const strings = catalogStrings(locale)
      expect(strings.length).toBeGreaterThan(0)
      for (const text of strings) {
        expect(text).not.toMatch(TOKEN_STATE_WORDS[locale]!)
        expect(text).not.toMatch(TOKEN_STATE_WORDS.en!)
      }
    },
  )
})
