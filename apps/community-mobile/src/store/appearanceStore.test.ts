import { beforeEach, test } from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { pathToFileURL } from "node:url"
import { installModuleStubs } from "../../tests/helpers/moduleHooks.ts"
import type * as AppearanceModule from "./appearanceStore.ts"

const require = createRequire(import.meta.url)
const UI_SCHEMES = pathToFileURL(
  join(dirname(require.resolve("@civfix/ui/package.json")), "src", "theme", "schemes.ts"),
)
const STUBS = new URL("../../tests/helpers/nativeStubs.ts", import.meta.url)
installModuleStubs({ "@/lib/mmkv": STUBS, "@civfix/ui/theme": UI_SCHEMES })

const { memory, resetStubs } = await import("../../tests/helpers/nativeStubs.ts")
const { APPEARANCE_KEY } = await import("../lib/mmkvKeys.ts")

let instance = 0

async function freshStore() {
  instance += 1
  const module = (await import(`./appearanceStore.ts?instance=${instance}`)) as typeof AppearanceModule
  return module.useAppearanceStore
}

function persisted(state: unknown, version: number): string {
  return JSON.stringify({ state, version })
}

beforeEach(() => {
  resetStubs()
})

test("a fresh install follows the system appearance", async () => {
  const store = await freshStore()
  assert.equal(store.getState().preference, "system")
})

test("a stored light, dark or system choice is restored", async () => {
  for (const preference of ["light", "dark", "system"]) {
    memory.set(APPEARANCE_KEY, persisted({ preference }, 1))
    const store = await freshStore()
    assert.equal(store.getState().preference, preference)
  }
})

test("an unknown, missing or non-string stored preference falls back to system", async () => {
  for (const state of [{ preference: "neon" }, { preference: 1 }, {}, null]) {
    memory.set(APPEARANCE_KEY, persisted(state, 1))
    const store = await freshStore()
    assert.equal(store.getState().preference, "system", JSON.stringify(state))
  }
})

test("an unparseable stored value keeps the default", async () => {
  memory.set(APPEARANCE_KEY, "{not json")
  const store = await freshStore()
  assert.equal(store.getState().preference, "system")
})

test("a stored value from another version is dropped with a console error, since there is no migration", async (t) => {
  const error = t.mock.method(console, "error", () => undefined)
  memory.set(APPEARANCE_KEY, persisted({ preference: "dark" }, 0))
  const store = await freshStore()
  assert.equal(store.getState().preference, "system")
  assert.equal(error.mock.callCount(), 1)
})

test("a choice is persisted as the preference alone under the appearance key", async () => {
  const store = await freshStore()
  store.getState().setPreference("dark")
  assert.equal(store.getState().preference, "dark")
  assert.equal(memory.get(APPEARANCE_KEY), persisted({ preference: "dark" }, 1))
})
