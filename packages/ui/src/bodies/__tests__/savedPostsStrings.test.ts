import { describe, expect, it } from "vitest"
import en from "../../i18n/locales/en/home-feed.json"
import es from "../../i18n/locales/es/home-feed.json"
import de from "../../i18n/locales/de/home-feed.json"
import ko from "../../i18n/locales/ko/home-feed.json"

/**
 * Every `home-feed` key PostDetailBody and SavedPostsBody read must exist in all four shipped locales; a
 * missing one renders the raw key string to the user.
 */
const KEYS = [
  ["thread", "loading_post"],
  ["thread", "post_error"],
  ["thread", "loading"],
  ["thread", "view_conversation"],
  ["saved", "loading"],
  ["saved", "error"],
  ["saved", "empty"],
  ["saved", "load_more"],
] as const

const CATALOGS: Record<string, Record<string, unknown>> = { en, es, de, ko }

describe("saved-posts + post-detail strings", () => {
  it("resolves every key the two bodies request in all four locales", () => {
    for (const [locale, catalog] of Object.entries(CATALOGS)) {
      for (const [section, key] of KEYS) {
        const value = (catalog[section] as Record<string, unknown> | undefined)?.[key]
        expect(typeof value, `${locale} ${section}.${key}`).toBe("string")
        expect(value, `${locale} ${section}.${key}`).not.toBe("")
      }
    }
  })
})
