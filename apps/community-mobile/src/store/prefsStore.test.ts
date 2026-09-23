import { beforeEach, test } from "node:test"
import assert from "node:assert/strict"
import { installModuleStubs } from "../../tests/helpers/moduleHooks.ts"

const STUBS = new URL("../../tests/helpers/nativeStubs.ts", import.meta.url)
installModuleStubs({
  "@/api/client": STUBS,
  "@/auth/storage": STUBS,
  "@/lib/locale": STUBS,
  "@/lib/mmkv": STUBS,
  "@/lib/nativeSecureStore": STUBS,
  "@/lib/ws": STUBS,
  "@/query/client": STUBS,
  "@/query/mmkv-persister": STUBS,
})

const { calls, control, memory, resetStubs } = await import("../../tests/helpers/nativeStubs.ts")
const { CACHED_USER_KEY, LOCALE_KEY } = await import("../lib/mmkv-keys.ts")
const { useAuthStore } = await import("./authStore.ts")
const { usePrefsStore } = await import("./prefsStore.ts")

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setImmediate(resolve))
}

beforeEach(() => {
  resetStubs()
  usePrefsStore.setState({ locale: "en" })
  useAuthStore.setState({ status: "unauthed", user: null })
})

test("the store seeds from the resolved locale at load", () => {
  assert.equal(usePrefsStore.getInitialState().locale, "en")
})

test("seeding a resolved locale neither writes storage nor syncs to the server", async () => {
  useAuthStore.setState({ status: "authed" })
  usePrefsStore.getState().setInitialLocale("de")
  await settle()
  assert.equal(usePrefsStore.getState().locale, "de")
  assert.equal(memory.has(LOCALE_KEY), false)
  assert.deepEqual(calls, [])
})

test("a signed-out switch is stored on the device only", async () => {
  usePrefsStore.getState().setLocale("es")
  await settle()
  assert.equal(usePrefsStore.getState().locale, "es")
  assert.equal(memory.get(LOCALE_KEY), "es")
  assert.deepEqual(calls, [])
})

test("a signed-in switch is stored, synced to the server, and refreshes the cached user", async () => {
  const user = { id: "u-1", name: "Ada", locale: "ko" }
  control.updateSettings = async () => ({ user })
  useAuthStore.setState({ status: "authed", user: { id: "u-1", name: "Ada" } as never })
  usePrefsStore.getState().setLocale("ko")
  await settle()
  assert.equal(memory.get(LOCALE_KEY), "ko")
  assert.deepEqual(calls, ['api.updateSettings:{"locale":"ko"}'])
  assert.deepEqual(useAuthStore.getState().user, user)
  assert.equal(memory.get(CACHED_USER_KEY), JSON.stringify(user))
})

test("a failed sync keeps the local choice and the signed-in user untouched", async () => {
  const before = { id: "u-1", name: "Ada" }
  control.updateSettings = async () => {
    throw new TypeError("offline")
  }
  useAuthStore.setState({ status: "authed", user: before as never })
  usePrefsStore.getState().setLocale("de")
  await settle()
  assert.equal(usePrefsStore.getState().locale, "de")
  assert.equal(memory.get(LOCALE_KEY), "de")
  assert.equal(useAuthStore.getState().user, before)
})

test("re-choosing the active locale still stores it and re-syncs", async () => {
  useAuthStore.setState({ status: "authed" })
  usePrefsStore.getState().setLocale("en")
  await settle()
  assert.equal(memory.get(LOCALE_KEY), "en")
  assert.deepEqual(calls, ['api.updateSettings:{"locale":"en"}'])
})
