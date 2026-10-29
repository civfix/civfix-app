import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { persistentStorage as webStorage } from "../persistentStorage.web"
import { APP_PROMO_STORAGE_ID, MAP_FILTERS_STORAGE_ID, SIDEBAR_STORAGE_ID } from "../storageIds"

// Each id's map outlives its instance, as an MMKV file outlives the app session that opened it.
const opened = vi.hoisted(() => ({ ids: [] as string[], fail: false, files: new Map<string, Map<string, string>>() }))

function file(id: string): Map<string, string> {
  const existing = opened.files.get(id)
  if (existing) return existing
  const created = new Map<string, string>()
  opened.files.set(id, created)
  return created
}

vi.mock("react-native-mmkv", () => ({
  MMKV: class {
    private readonly map: Map<string, string>
    constructor({ id }: { id: string }) {
      if (opened.fail) throw new Error("no native module")
      opened.ids.push(id)
      this.map = file(id)
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
    getAllKeys() {
      return [...this.map.keys()]
    }
    clearAll() {
      this.map.clear()
    }
  },
}))

async function freshNativeModule() {
  vi.resetModules()
  return import("../persistentStorage.native")
}

async function freshNative() {
  return (await freshNativeModule()).persistentStorage
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
    opened.files.clear()
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

describe("clearPersistentStorage on native", () => {
  beforeEach(() => {
    opened.ids = []
    opened.fail = false
    opened.files.clear()
  })

  it("T16: empties every store id, including one never opened this session", async () => {
    file(MAP_FILTERS_STORAGE_ID).set("civfix.map-filters", "{}")
    file(SIDEBAR_STORAGE_ID).set("civfix.sidebar-width", "{}")
    file(APP_PROMO_STORAGE_ID).set("civfix.app-promo-dismissed", "1")
    const { persistentStorage, clearPersistentStorage } = await freshNativeModule()
    persistentStorage(MAP_FILTERS_STORAGE_ID)
    persistentStorage(SIDEBAR_STORAGE_ID)

    clearPersistentStorage()

    expect([...opened.files.keys()].sort()).toEqual(
      [APP_PROMO_STORAGE_ID, MAP_FILTERS_STORAGE_ID, SIDEBAR_STORAGE_ID].sort(),
    )
    for (const [id, keys] of opened.files) expect([...keys.keys()], id).toEqual([])
  })
})

describe("persistentStorage on web", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

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
