import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { URL } from "node:url"

type Catalog = { [key: string]: string | Catalog }

const catalog = (locale: string): Catalog =>
  JSON.parse(
    readFileSync(
      new URL(
        `../../../packages/ui/src/i18n/locales/${locale}/mobile-update.json`,
        import.meta.url,
      ),
      "utf8",
    ),
  ) as Catalog

function entries(node: Catalog, prefix = ""): [string, string][] {
  return Object.entries(node).flatMap(([key, value]): [string, string][] =>
    typeof value === "string" ? [[`${prefix}${key}`, value]] : entries(value, `${prefix}${key}.`),
  )
}

test("T26: the en mobile-update catalog holds the update screen's words, and every locale has its keys", () => {
  const en = entries(catalog("en"))
  const values = en.map(([, value]) => value)
  for (const text of [
    "Please update civfix",
    "This version is no longer supported.",
    "Update",
    "Update civfix from the App Store.",
    "Update civfix from Google Play.",
  ]) {
    assert.ok(values.includes(text), text)
  }
  const keys = en.map(([key]) => key).sort()
  for (const locale of ["de", "es", "ko"]) {
    assert.deepEqual(
      entries(catalog(locale))
        .map(([key]) => key)
        .sort(),
      keys,
      locale,
    )
  }
})
