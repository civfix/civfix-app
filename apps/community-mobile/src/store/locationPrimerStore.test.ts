import { beforeEach, test } from "node:test"
import assert from "node:assert/strict"
import { installModuleStubs } from "../../tests/helpers/moduleHooks.ts"
import type * as LocationPrimerModule from "./locationPrimerStore.ts"

const STUBS = new URL("../../tests/helpers/nativeStubs.ts", import.meta.url)
installModuleStubs({ "@/lib/mmkv": STUBS })

const { memory, resetStubs } = await import("../../tests/helpers/nativeStubs.ts")
const { LOCATION_PRIMER_KEY } = await import("../lib/mmkvKeys.ts")

let instance = 0

async function freshStore() {
  instance += 1
  const module = (await import(`./locationPrimerStore.ts?instance=${instance}`)) as typeof LocationPrimerModule
  return module.useLocationPrimerStore
}

function persisted(state: unknown, version: number): string {
  return JSON.stringify({ state, version })
}

function primer(store: Awaited<ReturnType<typeof freshStore>>) {
  const { shown, choice } = store.getState()
  return { shown, choice }
}

beforeEach(() => {
  resetStubs()
})

test("the primer has not been shown on a fresh install", async () => {
  assert.deepEqual(primer(await freshStore()), { shown: false, choice: null })
})

test("a current-version record is restored as stored", async () => {
  memory.set(LOCATION_PRIMER_KEY, persisted({ shown: true, choice: "approximate" }, 2))
  assert.deepEqual(primer(await freshStore()), { shown: true, choice: "approximate" })
})

test("a version-1 record keeps only whether the primer was shown and rewrites itself as version 2", async () => {
  memory.set(LOCATION_PRIMER_KEY, persisted({ shown: true, choice: "precise" }, 1))
  assert.deepEqual(primer(await freshStore()), { shown: true, choice: null })
  assert.equal(memory.get(LOCATION_PRIMER_KEY), persisted({ shown: true, choice: null }, 2))
})

test("a migrated record counts as shown only for a literal true", async () => {
  for (const state of [{ shown: "yes" }, { shown: 1 }, {}, null]) {
    memory.set(LOCATION_PRIMER_KEY, persisted(state, 1))
    assert.deepEqual(primer(await freshStore()), { shown: false, choice: null }, JSON.stringify(state))
  }
})

test("a record from a newer version is migrated down the same way", async () => {
  memory.set(LOCATION_PRIMER_KEY, persisted({ shown: true, choice: "precise" }, 3))
  assert.deepEqual(primer(await freshStore()), { shown: true, choice: null })
})

test("choosing a precision marks the primer shown and persists both", async () => {
  const store = await freshStore()
  store.getState().setChoice("precise")
  assert.deepEqual(primer(store), { shown: true, choice: "precise" })
  assert.equal(memory.get(LOCATION_PRIMER_KEY), persisted({ shown: true, choice: "precise" }, 2))
})

test("marking the primer shown leaves the choice unset", async () => {
  const store = await freshStore()
  store.getState().markShown()
  assert.deepEqual(primer(store), { shown: true, choice: null })
  assert.equal(memory.get(LOCATION_PRIMER_KEY), persisted({ shown: true, choice: null }, 2))
})
