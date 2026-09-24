import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { persistentStorage } from "../../storage/persistentStorage"
import { APP_PROMO_STORAGE_ID } from "../../storage/storageIds"
import { appPromoStorage } from "../appPromoStorage"
import { appPromoStorage as nativeAppPromoStorage } from "../appPromoStorage.native"

describe("appPromoStorage", () => {
  it("persists the web dismissal in the promo's own storage", () => {
    expect(appPromoStorage()).toBe(persistentStorage(APP_PROMO_STORAGE_ID))
  })

  it("remembers nothing on native, where the promo never renders", () => {
    const storage = nativeAppPromoStorage()
    storage.setItem("civfix.app-promo-dismissed", "{}")
    expect(storage.getItem("civfix.app-promo-dismissed")).toBeNull()
  })

  it("opens no MMKV instance on native", () => {
    const source = readFileSync(new URL("../appPromoStorage.native.ts", import.meta.url), "utf8")
    const imports = source.match(/^import .*$/gm) ?? []
    expect(imports).toEqual(['import type { StateStorage } from "zustand/middleware"'])
  })
})
