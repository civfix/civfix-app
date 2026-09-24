import type { ResourceLanguage } from "i18next"
import type { SupportedLocale } from "@civfix/shared"
import { describe, expect, it } from "vitest"
import { createI18n } from "../config"
import { hasCatalog, makeLocaleSwitcher, type CatalogLoader } from "../localeSwitcher"

const GERMAN: ResourceLanguage = { common: { lazy_fixture: "Deutsch" } }
const KOREAN: ResourceLanguage = { common: { lazy_fixture: "한국어" } }

function deferredLoader() {
  const pending = new Map<SupportedLocale, { resolve: (c: ResourceLanguage) => void; reject: (e: Error) => void }>()
  const calls: SupportedLocale[] = []
  const load: CatalogLoader = (lng) => {
    calls.push(lng)
    return new Promise((resolve, reject) => pending.set(lng, { resolve, reject }))
  }
  return { load, calls, pending }
}

function englishInstance() {
  const i18n = createI18n("de")
  i18n.addResource("en", "common", "lazy_fixture", "English")
  return i18n
}

describe("switching to a locale whose catalog is not bundled", () => {
  it("starts in English, not in a language it has no strings for", () => {
    const i18n = createI18n("de")
    expect(i18n.language).toBe("en")
    expect(hasCatalog(i18n, "de")).toBe(false)
  })

  it("stays in English until the catalog arrives, then adds it before changing language", async () => {
    const i18n = englishInstance()
    const { load, pending } = deferredLoader()
    const seenOnChange: string[] = []
    i18n.on("languageChanged", () => seenOnChange.push(i18n.t("common:lazy_fixture")))

    const switched = makeLocaleSwitcher(i18n, load)("de")
    await Promise.resolve()
    expect(i18n.language).toBe("en")
    expect(i18n.t("common:lazy_fixture")).toBe("English")

    pending.get("de")!.resolve(GERMAN)
    expect(await switched).toBe(true)
    expect(i18n.language).toBe("de")
    expect(seenOnChange).toEqual(["Deutsch"])
  })

  it("keeps English and resolves false when the chunk fails, then retries on the next request", async () => {
    const i18n = englishInstance()
    const { load, calls, pending } = deferredLoader()
    const switchLocale = makeLocaleSwitcher(i18n, load)

    const failed = switchLocale("de")
    pending.get("de")!.reject(new Error("ChunkLoadError"))
    expect(await failed).toBe(false)
    expect(i18n.language).toBe("en")
    expect(hasCatalog(i18n, "de")).toBe(false)

    const retried = switchLocale("de")
    pending.get("de")!.resolve(GERMAN)
    expect(await retried).toBe(true)
    expect(calls).toEqual(["de", "de"])
    expect(i18n.t("common:lazy_fixture")).toBe("Deutsch")
  })

  it("never applies a catalog that a newer request superseded, but keeps it for later", async () => {
    const i18n = englishInstance()
    const { load, calls, pending } = deferredLoader()
    const switchLocale = makeLocaleSwitcher(i18n, load)

    const toGerman = switchLocale("de")
    const toKorean = switchLocale("ko")
    pending.get("ko")!.resolve(KOREAN)
    expect(await toKorean).toBe(true)
    pending.get("de")!.resolve(GERMAN)
    expect(await toGerman).toBe(false)
    expect(i18n.language).toBe("ko")

    expect(await switchLocale("de")).toBe(true)
    expect(i18n.language).toBe("de")
    expect(calls).toEqual(["de", "ko"])
  })

  it("does not apply a late catalog after the viewer went back to English", async () => {
    const i18n = englishInstance()
    const { load, pending } = deferredLoader()
    const switchLocale = makeLocaleSwitcher(i18n, load)

    const toGerman = switchLocale("de")
    expect(await switchLocale("en")).toBe(true)
    pending.get("de")!.resolve(GERMAN)
    expect(await toGerman).toBe(false)
    expect(i18n.language).toBe("en")
  })
})

describe("switching to a locale whose catalog is present", () => {
  it("changes language synchronously without loading anything", () => {
    const i18n = englishInstance()
    i18n.addResourceBundle("de", "common", GERMAN.common)
    const { load, calls } = deferredLoader()

    void makeLocaleSwitcher(i18n, load)("de")
    expect(i18n.language).toBe("de")
    expect(calls).toEqual([])
  })

  it("emits no languageChanged when the locale is already active", async () => {
    const i18n = englishInstance()
    let changes = 0
    i18n.on("languageChanged", () => changes++)
    expect(await makeLocaleSwitcher(i18n, deferredLoader().load)("en")).toBe(true)
    expect(changes).toBe(0)
  })
})
