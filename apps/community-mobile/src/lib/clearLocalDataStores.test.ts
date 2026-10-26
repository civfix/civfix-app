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
installModuleStubs({
  "@civfix/ui": new URL("../../tests/helpers/uiStorageStubs.ts", import.meta.url),
  "@civfix/ui/data": STUBS,
  "@civfix/ui/theme": UI_SCHEMES,
  "@/api/client": STUBS,
  "@/auth/storage": STUBS,
  "@/lib/locale": STUBS,
  "@/lib/mmkv": STUBS,
  "@/lib/nativeSecureStore": STUBS,
  "@/lib/ws": STUBS,
  "@/query/client": STUBS,
  "@/query/mmkvPersister": STUBS,
  "react-native-mmkv": new URL("../../tests/helpers/mmkvStub.ts", import.meta.url),
  // @civfix/ui imports without extensions, which Node does not resolve.
  "./storageIds": new URL("../../../../packages/ui/src/storage/storageIds.ts", import.meta.url),
})

const { calls, control, memory, resetStubs } = await import("../../tests/helpers/nativeStubs.ts")
const { DEFAULT_APPEARANCE_PREFERENCE } = (await import(UI_SCHEMES.href)) as { DEFAULT_APPEARANCE_PREFERENCE: string }
const { APPEARANCE_KEY, LOCALE_KEY, LOCATION_PRIMER_KEY, ONBOARDING_KEY } = await import("./mmkvKeys.ts")
const { useAuthStore } = await import("../store/authStore.ts")
const { useOnboardingStore } = await import("../store/onboardingStore.ts")
const { useLocationPrimerStore } = await import("../store/locationPrimerStore.ts")
const { useAppearanceStore } = await import("../store/appearanceStore.ts")
const { usePrefsStore } = await import("../store/prefsStore.ts")
const { clearAllLocalDataAndSignOut } = await import("./clearLocalData.ts")

const USER = { id: "u-1", name: "Ada" }

// The stores hold a used install's state in memory, as they do when the Developer screen runs the clear.
before(async () => {
  resetStubs()
  useOnboardingStore.getState().complete()
  useLocationPrimerStore.getState().setChoice("precise")
  useAppearanceStore.getState().setPreference("dark")
  usePrefsStore.getState().setLocale("de")
  control.token = { ok: true, token: "tok" }
  useAuthStore.setState({ status: "authed", user: USER as never })
  await clearAllLocalDataAndSignOut()
})

test("each app store is back at a fresh install's values, except the tour, which waits for the next launch", () => {
  assert.equal(useOnboardingStore.getState().completedVersion, 1)
  assert.deepEqual(
    { shown: useLocationPrimerStore.getState().shown, choice: useLocationPrimerStore.getState().choice },
    { shown: false, choice: null },
  )
  assert.equal(useAppearanceStore.getState().preference, DEFAULT_APPEARANCE_PREFERENCE)
  assert.equal(usePrefsStore.getState().locale, "en")
  assert.equal(calls.filter((call) => call === "resetPersistedStores").length, 1)
})

test("a store write after the clear stores none of the cleared data", () => {
  useOnboardingStore.getState().setGateActive(true)
  useOnboardingStore.getState().setPresenting(false)
  useLocationPrimerStore.setState({})
  useAppearanceStore.setState({})

  assert.equal(memory.get(ONBOARDING_KEY), JSON.stringify({ state: { completedVersion: 0 }, version: 1 }))
  assert.equal(memory.get(LOCATION_PRIMER_KEY), JSON.stringify({ state: { shown: false, choice: null }, version: 2 }))
  assert.equal(
    memory.get(APPEARANCE_KEY),
    JSON.stringify({ state: { preference: DEFAULT_APPEARANCE_PREFERENCE }, version: 1 }),
  )
  assert.equal(memory.has(LOCALE_KEY), false)
})
