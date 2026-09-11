import { afterEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_APPEARANCE_PREFERENCE } from "../schemes"
import {
  getAppearancePreference,
  makeMemoryAppearanceStore,
  setAppearancePreference,
  setAppearancePreferenceStore,
} from "../appearance"

afterEach(() => {
  setAppearancePreferenceStore(null)
  setAppearancePreference(DEFAULT_APPEARANCE_PREFERENCE)
})

describe("appearance preference seam", () => {
  it("defaults to the device scheme with no host store registered", () => {
    expect(DEFAULT_APPEARANCE_PREFERENCE).toBe("system")
    expect(getAppearancePreference()).toBe("system")
  })

  it("routes reads and writes through a registered host store", () => {
    const host = makeMemoryAppearanceStore("dark")
    setAppearancePreferenceStore(host)
    expect(getAppearancePreference()).toBe("dark")
    setAppearancePreference("light")
    expect(host.get()).toBe("light")
  })

  it("falls back to the memory store once the host unregisters", () => {
    setAppearancePreferenceStore(makeMemoryAppearanceStore("dark"))
    setAppearancePreferenceStore(null)
    expect(getAppearancePreference()).toBe("system")
  })

  it("notifies subscribers only on a real change", () => {
    const store = makeMemoryAppearanceStore()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    store.set("system")
    expect(listener).not.toHaveBeenCalled()
    store.set("dark")
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    store.set("light")
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
