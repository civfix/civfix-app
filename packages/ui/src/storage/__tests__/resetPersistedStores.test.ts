import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it, vi } from "vitest"

// Each id's map stands for its MMKV file.
const files = vi.hoisted(() => new Map<string, Map<string, string>>())

vi.mock("react-native-mmkv", () => ({
  MMKV: class {
    private readonly map: Map<string, string>
    constructor({ id }: { id: string }) {
      const existing = files.get(id) ?? new Map<string, string>()
      files.set(id, existing)
      this.map = existing
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
    clearAll() {
      this.map.clear()
    }
  },
}))

// The phone app's storage seams, which platform-unaware tooling would resolve to the web ones.
vi.mock("../persistentStorage", () => import("../persistentStorage.native"))
vi.mock("../../shell/sidebarStorage", () => import("../../shell/sidebarStorage.native"))
vi.mock("../../promo/appPromoStorage", () => import("../../promo/appPromoStorage.native"))

const { clearPersistentStorage } = await import("../persistentStorage.native")
const { resetPersistedStores } = await import("../resetPersistedStores")
const { FILTER_CATEGORIES, useReportFilterStore } = await import("../../map/filterStore")
const { useSearchRecentStore } = await import("../../bodies/search/searchRecentStore")
const { SIDEBAR_DEFAULT_WIDTH, useSidebarStore } = await import("../../shell/sidebarStore")
const { useAppPromoStore } = await import("../../promo/appPromoStore")

const SRC = fileURLToPath(new URL("../../", import.meta.url))

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : sources(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })
}

function stored(): string[] {
  return [...files.values()].flatMap((file) => [...file.values()])
}

describe("resetPersistedStores", () => {
  it("returns every store to a fresh install's values, so a write after the clear stores none of the old data", () => {
    useReportFilterStore.getState().toggle(FILTER_CATEGORIES[0]!)
    useReportFilterStore.getState().toggleEvents()
    useSearchRecentStore.getState().record("old park")
    useSidebarStore.getState().setWidth(600)
    useAppPromoStore.getState().dismiss()
    expect(stored().join("\n")).toContain("old park")

    resetPersistedStores()
    clearPersistentStorage()
    expect(stored()).toEqual([])

    useReportFilterStore.getState().setLayersOpen(true)
    useSearchRecentStore.setState({})
    useSidebarStore.setState({})
    useAppPromoStore.setState({})

    expect([...useReportFilterStore.getState().enabled].sort()).toEqual(
      [...FILTER_CATEGORIES].sort(),
    )
    expect(useReportFilterStore.getState().eventsEnabled).toBe(true)
    expect(useSearchRecentStore.getState().recent).toEqual([])
    expect(useSidebarStore.getState().width).toBe(SIDEBAR_DEFAULT_WIDTH)
    expect(useAppPromoStore.getState().dismissed).toBe(false)
    const after = stored().join("\n")
    expect(after).not.toContain("old park")
    expect(after).not.toContain("600")
    expect(after).toContain('"eventsEnabled":true')
  })

  it("covers every persisted store in the package", () => {
    const resetter = readFileSync(join(SRC, "storage/resetPersistedStores.ts"), "utf8")
    const persisted = sources(SRC)
      .filter((path) => /\bpersist\(/.test(readFileSync(path, "utf8")))
      .map((path) => relative(SRC, path).replace(/\.tsx?$/, ""))
    expect(persisted.length).toBeGreaterThan(0)
    for (const module of persisted) expect(resetter, module).toContain(`from "../${module}"`)
  })
})
