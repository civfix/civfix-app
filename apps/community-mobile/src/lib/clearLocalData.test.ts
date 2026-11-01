import { before, test } from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { pathToFileURL } from "node:url"
import { installModuleStubs } from "../../tests/helpers/moduleHooks.ts"

const require = createRequire(import.meta.url)
const UI_SCHEMES = pathToFileURL(
  join(dirname(require.resolve("@civfix/ui/package.json")), "src", "theme", "schemes.ts"),
)
const STUBS = new URL("../../tests/helpers/nativeStubs.ts", import.meta.url)
const STORAGE_IDS = new URL("../../../../packages/ui/src/storage/storageIds.ts", import.meta.url)
installModuleStubs({
  "@civfix/ui": new URL("../../tests/helpers/uiStorageStubs.ts", import.meta.url),
  "@civfix/ui/data": STUBS,
  "@civfix/ui/theme": UI_SCHEMES,
  "@/lib/locale": STUBS,
  "@/api/client": STUBS,
  "@/auth/storage": STUBS,
  "@/lib/mmkv": STUBS,
  "@/lib/nativeSecureStore": STUBS,
  "@/lib/ws": STUBS,
  "@/query/client": STUBS,
  "@/query/mmkvPersister": STUBS,
  "expo-secure-store": new URL("../../tests/helpers/secureSessionStubs.ts", import.meta.url),
  "react-native-mmkv": new URL("../../tests/helpers/mmkvStub.ts", import.meta.url),
  // @civfix/ui imports without extensions, which Node does not resolve.
  "./storageIds": STORAGE_IDS,
})

const { calls, control, memory, resetStubs } = await import("../../tests/helpers/nativeStubs.ts")
const { keychain } = await import("../../tests/helpers/secureSessionStubs.ts")
const { mmkvFile, mmkvFiles } = await import("../../tests/helpers/mmkvStub.ts")
const { persistentStorage } = await import("../../tests/helpers/uiStorageStubs.ts")
const storageIds = await import("../../../../packages/ui/src/storage/storageIds.ts")
const { APPEARANCE_KEY, CACHED_USER_KEY, LOCALE_KEY, ONBOARDING_KEY } =
  await import("./mmkvKeys.ts")
const { PUSH_REGISTRATION_KEY } = await import("./pushRegistration.ts")
const { DEVICE_ID_KEY } = await import("./deviceId.ts")
const { useAuthStore } = await import("../store/authStore.ts")
const { clearAllLocalDataAndSignOut } = await import("./clearLocalData.ts")

const USER = { id: "u-1", name: "Ada" }
const UI_STORAGE_IDS = Object.values(storageIds).flatMap((value) =>
  typeof value === "string" ? [value] : [],
)

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setImmediate(resolve))
}

function keysIn(id: string): string[] {
  return [...(mmkvFiles.get(id)?.keys() ?? [])]
}

const realSignOut = useAuthStore.getState().signOut

// One clear in this module session, so the app-promo store is never opened before it runs. The store's own
// signOut runs behind a spy that records what it starts on and holds it open until the clear is checked.
const flow = {
  runs: 0,
  pushStoredAtStart: false,
  callsBeforeRelease: [] as string[],
  appStorageBeforeRelease: [] as string[],
  filtersBeforeRelease: [] as string[],
  runsAfter: 0,
}

before(async () => {
  resetStubs()
  control.token = { ok: true, token: "tok" }
  memory.set(CACHED_USER_KEY, JSON.stringify(USER))
  memory.set(PUSH_REGISTRATION_KEY, JSON.stringify({ platform: "android", token: "t" }))
  memory.set(ONBOARDING_KEY, JSON.stringify({ state: { completedVersion: 1 }, version: 1 }))
  memory.set(LOCALE_KEY, "de")
  memory.set(APPEARANCE_KEY, JSON.stringify({ state: { preference: "dark" }, version: 0 }))
  persistentStorage(storageIds.MAP_FILTERS_STORAGE_ID).setItem("civfix.map-filters", "{}")
  persistentStorage(storageIds.SIDEBAR_STORAGE_ID).setItem("civfix.sidebar-width", "{}")
  mmkvFile(storageIds.APP_PROMO_STORAGE_ID).set("civfix.app-promo-dismissed", "1")
  keychain.set(DEVICE_ID_KEY, "dev-1")
  useAuthStore.setState({ status: "authed", user: USER as never })

  let release: () => void = () => {}
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  useAuthStore.setState({
    signOut: async () => {
      flow.runs += 1
      flow.pushStoredAtStart = memory.has(PUSH_REGISTRATION_KEY)
      await realSignOut()
      await released
    },
  })

  const cleared = clearAllLocalDataAndSignOut()
  await settle()
  flow.callsBeforeRelease = [...calls]
  flow.appStorageBeforeRelease = [...memory.keys()]
  flow.filtersBeforeRelease = keysIn(storageIds.MAP_FILTERS_STORAGE_ID)
  release()
  await cleared
  flow.runsAfter = flow.runs
})

test("T14: the normal sign-out runs once, with push still registered, and finishes before anything is cleared", () => {
  assert.equal(flow.runs, 1)
  assert.equal(flow.runsAfter, 1)
  assert.equal(flow.pushStoredAtStart, true)
  assert.ok(
    flow.callsBeforeRelease.includes("api.pushUnregister:t:Bearer tok"),
    flow.callsBeforeRelease.join("\n"),
  )
  assert.ok(
    flow.callsBeforeRelease.includes("api.logout:Bearer tok"),
    flow.callsBeforeRelease.join("\n"),
  )
  assert.ok(
    flow.appStorageBeforeRelease.includes(ONBOARDING_KEY),
    "the app storage waits for the sign-out",
  )
  assert.deepEqual(flow.filtersBeforeRelease, ["civfix.map-filters"])
})

test("T15: then every local store is empty except the device id, and the app is signed out", () => {
  assert.deepEqual([...memory.keys()], [])
  assert.deepEqual([...UI_STORAGE_IDS].sort(), [
    "civfix.ui.app-promo",
    "civfix.ui.filters",
    "civfix.ui.sidebar",
    "civfix.ui.system-notice",
  ])
  for (const id of UI_STORAGE_IDS) assert.deepEqual(keysIn(id), [], id)
  assert.equal(keychain.get(DEVICE_ID_KEY), "dev-1")
  assert.equal(useAuthStore.getState().status, "unauthed")
})
