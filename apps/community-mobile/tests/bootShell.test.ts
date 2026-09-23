import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const layout = readFileSync(new URL("../app/_layout.tsx", import.meta.url), "utf8")
const home = readFileSync(new URL("../app/index.tsx", import.meta.url), "utf8")
const config = readFileSync(new URL("../src/config.ts", import.meta.url), "utf8")
const apiUrlModule = readFileSync(new URL("../src/lib/apiUrl.ts", import.meta.url), "utf8")
const betaInstallModule = readFileSync(
  new URL("../src/lib/nativeBetaInstall.ts", import.meta.url),
  "utf8",
)
const storeKitModule = readFileSync(new URL("../src/lib/storeKitReceipt.ts", import.meta.url), "utf8")
const mmkvModule = readFileSync(new URL("../src/lib/mmkv.ts", import.meta.url), "utf8")
const secureStoreModule = readFileSync(
  new URL("../src/lib/nativeSecureStore.ts", import.meta.url),
  "utf8",
)
const authStorage = readFileSync(new URL("../src/auth/storage.ts", import.meta.url), "utf8")
const appConfig = readFileSync(new URL("../app.config.js", import.meta.url), "utf8")

test("the root layout exports an ErrorBoundary so expo-router can catch a boot crash", () => {
  assert.match(layout, /export function ErrorBoundary\(\{ error, retry \}: ErrorBoundaryProps\)/)
})

test("the root layout anchors every deep link under the home route", () => {
  assert.match(layout, /export const unstable_settings = \{ anchor: "index" \}/)
})

test("the focused root clears the nested-shell signal, and nothing else touches the nav stack", () => {
  assert.match(home, /clearNestedShellHosts\(\)/)
  assert.doesNotMatch(home, /stackWithoutShellHosted/)
  assert.doesNotMatch(home, /navTeardownEpoch/)
})

test("the crash retry drops the persisted AND in-memory cache before re-rendering", () => {
  const body = layout.slice(layout.indexOf("export function ErrorBoundary"))
  const purge = body.indexOf("purgeQueryCache(queryClient)")
  const again = body.indexOf("void retry()")

  assert.ok(purge > -1 && again > purge)
})

test("the splash is bounded by a watchdog, so a stalled font load cannot hold it forever", () => {
  assert.match(layout, /const SPLASH_WATCHDOG_MS = \d+/)
  assert.match(layout, /setTimeout\(\(\) => setFontWaitElapsed\(true\), SPLASH_WATCHDOG_MS\)/)
  assert.match(layout, /SplashScreen\.hideAsync\(\)\.catch\(/)
})

test("the loading gate stops hit-testing the moment it starts fading out", () => {
  assert.match(layout, /pointerEvents=\{gateActive \? "auto" : "none"\}/)
  assert.doesNotMatch(layout, /exiting=\{FadeOut/)
})

test("push registration latches on a terminal outcome, never before the async work", () => {
  const hook = layout.slice(layout.indexOf("function usePushOnSignIn"))
  assert.match(hook, /if \(!shouldAttemptPushRegistration\(state\)\) return/)
  assert.match(hook, /if \(isPushOutcomeTerminal\(result\.status\)\) \{\n\s+state\.settled = true/)
  assert.match(hook, /if \(isForegroundEdge\(attemptRef\.current, next\)\) attempt\(\)/)
})

test("every external URL is validated before it reaches Linking.openURL", () => {
  const capability = layout.slice(layout.indexOf("openExternal: {"))
  const guard = capability.indexOf("if (!isExternalUrl(url))")
  const open = capability.indexOf("Linking.openURL(url)")
  assert.ok(guard > -1 && open > guard)
})

test("a bare dev bundle points at localhost, never silently at production", () => {
  assert.match(apiUrlModule, /export const DEV_API_URL = "http:\/\/localhost:8080"/)
  assert.match(apiUrlModule, /export const STAGING_API_URL = "https:\/\/api\.civfix\.dev"/)
  assert.match(apiUrlModule, /export const PROD_API_URL = "https:\/\/api\.civfix\.org"/)
})

test("the base URL goes through the guarded resolver, never a bare ?? on the baked value", () => {
  assert.match(config, /resolveApiUrl\(extra\.apiUrl, __DEV__, isBetaInstall\(\)\)/)
  assert.doesNotMatch(config, /extra\.apiUrl \?\?/)
  assert.match(apiUrlModule, /typeof configured === "string"/)
})

test("the install probe is iOS-only and reads the ACTIVE StoreKit receipt", () => {
  assert.match(betaInstallModule, /if \(Platform\.OS !== "ios"\) return false/)
  assert.match(betaInstallModule, /betaInstallFromReceipts\(probe\.store, probe\.sandbox\)/)
  assert.match(betaInstallModule, /Paths\.document\.parentDirectory/)
  assert.match(storeKitModule, /export const APP_STORE_RECEIPT = "receipt"/)
  assert.match(storeKitModule, /export const SANDBOX_RECEIPT = "sandboxReceipt"/)
})

test("the receipt decision runs store-first, and only a NEWER sandbox receipt means staging", () => {
  assert.match(storeKitModule, /if \(!sandbox\.present\) return false/)
  assert.match(storeKitModule, /if \(!store\.present\) return true/)
  assert.match(
    storeKitModule,
    /if \(store\.modifiedAt === null \|\| sandbox\.modifiedAt === null\) return false/,
  )
  assert.match(storeKitModule, /return sandbox\.modifiedAt > store\.modifiedAt/)
})

test("expo-file-system is required inside the guarded probe, never imported into the boot chain", () => {
  assert.doesNotMatch(betaInstallModule, /^import .*"expo-file-system"/m)
  const probe = betaInstallModule.slice(betaInstallModule.indexOf("function probeStoreKit"))
  const guard = probe.indexOf("try {")
  const load = probe.indexOf('require("expo-file-system")')
  assert.ok(guard > -1 && load > guard)
  assert.match(probe, /catch \{\s*return PROBE_UNAVAILABLE\s*}/)
  assert.match(betaInstallModule, /const PROBE_UNAVAILABLE: StoreKitProbe = \{\s*dir: null,/)
})

test("persisted state is scoped to the API environment, production keeping the legacy ids", () => {
  assert.match(mmkvModule, /scopeStorageId\("civfix\.app", API_URL\)/)
  assert.match(secureStoreModule, /scopeStorageId\("civfix\.secure-blobs\.key", API_URL\)/)
  assert.match(secureStoreModule, /scopeStorageId\("civfix\.secure", API_URL\)/)
  assert.match(authStorage, /scopeStorageId\("civfix\.session\.token", API_URL\)/)
})

test("the app config OMITS apiUrl when unset rather than baking a null Expo turns into {}", () => {
  assert.match(appConfig, /\.\.\.\(API_URL \? \{ apiUrl: API_URL \} : \{\}\)/)
  assert.doesNotMatch(appConfig, /^\s+apiUrl: API_URL,\s*$/m)
})

test("the About presenter is registered for the ROUTER's lifetime, not a leaf screen's", () => {
  assert.match(layout, /function BrandAboutBridge\(\): null \{/)
  assert.match(layout, /setBrandAboutPresenter\(\(\) => router\.push\("\/about"\)\)/)
  assert.match(layout, /return \(\) => setBrandAboutPresenter\(null\)/)
  assert.match(layout, /<BrandAboutBridge \/>/)
  assert.doesNotMatch(home, /setBrandAboutPresenter/)
})

test("the android navigation bar glyphs follow the active scheme", () => {
  assert.match(layout, /import \* as NavigationBar from "expo-navigation-bar"/)
  assert.match(layout, /NavigationBar\.setButtonStyleAsync\(scheme === "dark" \? "light" : "dark"\)/)
})
