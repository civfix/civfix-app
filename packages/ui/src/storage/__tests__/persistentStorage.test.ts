import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { persistentStorage as webStorage } from "../persistentStorage.web"
import { APP_PROMO_STORAGE_ID, MAP_FILTERS_STORAGE_ID, SIDEBAR_STORAGE_ID } from "../storageIds"

const opened = vi.hoisted(() => ({ ids: [] as string[], fail: false }))

vi.mock("react-native-mmkv", () => ({
  MMKV: class {
    private readonly map = new Map<string, string>()
    constructor({ id }: { id: string }) {
      if (opened.fail) throw new Error("no native module")
      opened.ids.push(id)
    }
    getString(key: string) {
      return this.map.get(key)
    }
    set(key: string, value: string) {
      this.map.set(key, value)
    }
    delete(key: string) {
      this.map.delete(key)
    }
  },
}))

async function freshNative() {
  vi.resetModules()
  return (await import("../persistentStorage.native")).persistentStorage
}

describe("the native MMKV instance ids", () => {
  it("never change, because each names the file a user's saved state lives in", () => {
    expect(MAP_FILTERS_STORAGE_ID).toBe("civfix.ui.filters")
    expect(SIDEBAR_STORAGE_ID).toBe("civfix.ui.sidebar")
    expect(APP_PROMO_STORAGE_ID).toBe("civfix.ui.app-promo")
  })
})

describe("persistentStorage on native", () => {
  beforeEach(() => {
    opened.ids = []
    opened.fail = false
  })

  it("opens MMKV under exactly the id it is given and round-trips a value", async () => {
    const persistentStorage = await freshNative()
    const storage = persistentStorage(SIDEBAR_STORAGE_ID)
    expect(opened.ids).toEqual(["civfix.ui.sidebar"])
    storage.setItem("civfix.sidebar-width", '{"state":{"width":480}}')
    expect(storage.getItem("civfix.sidebar-width")).toBe('{"state":{"width":480}}')
    storage.removeItem("civfix.sidebar-width")
    expect(storage.getItem("civfix.sidebar-width")).toBeNull()
  })

  it("hands every store that shares an id the one instance", async () => {
    const persistentStorage = await freshNative()
    const filters = persistentStorage(MAP_FILTERS_STORAGE_ID)
    const recents = persistentStorage(MAP_FILTERS_STORAGE_ID)
    expect(recents).toBe(filters)
    expect(opened.ids).toEqual(["civfix.ui.filters"])
    expect(persistentStorage(APP_PROMO_STORAGE_ID)).not.toBe(filters)
  })

  it("degrades to memory when the native module cannot be constructed, so imports never crash", async () => {
    opened.fail = true
    const persistentStorage = await freshNative()
    const storage = persistentStorage(APP_PROMO_STORAGE_ID)
    storage.setItem("civfix.app-promo-dismissed", "1")
    expect(storage.getItem("civfix.app-promo-dismissed")).toBe("1")
  })
})

describe("persistentStorage on web", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("is a no-op during the static-export build, where there is no window", () => {
    const storage = webStorage(MAP_FILTERS_STORAGE_ID)
    expect(storage.getItem("civfix.map-filters")).toBeNull()
    expect(() => storage.setItem("civfix.map-filters", "{}")).not.toThrow()
    expect(() => storage.removeItem("civfix.map-filters")).not.toThrow()
  })

  it("reads and writes localStorage under the persist name, whatever the native id", () => {
    const data = new Map<string, string>()
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => void data.set(key, value),
        removeItem: (key: string) => void data.delete(key),
      },
    })
    webStorage(APP_PROMO_STORAGE_ID).setItem("civfix.app-promo-dismissed", "1")
    expect(data.get("civfix.app-promo-dismissed")).toBe("1")
    expect(webStorage(MAP_FILTERS_STORAGE_ID).getItem("civfix.app-promo-dismissed")).toBe("1")
    webStorage(SIDEBAR_STORAGE_ID).removeItem("civfix.app-promo-dismissed")
    expect(data.has("civfix.app-promo-dismissed")).toBe(false)
  })

  it("treats blocked storage (private mode) as nothing saved and swallows the write", () => {
    const blocked = () => {
      throw new Error("SecurityError")
    }
    vi.stubGlobal("window", { localStorage: { getItem: blocked, setItem: blocked, removeItem: blocked } })
    const storage = webStorage(MAP_FILTERS_STORAGE_ID)
    expect(storage.getItem("civfix.map-filters")).toBeNull()
    expect(() => storage.setItem("civfix.map-filters", "{}")).not.toThrow()
    expect(() => storage.removeItem("civfix.map-filters")).not.toThrow()
  })
})
