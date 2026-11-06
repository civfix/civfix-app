import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { appConfigForVariant, pluginOptions } from "./helpers/appConfig.ts"

const KEEP_RULES = [
  "-keep class org.maplibre.android.** { *; }",
  "-keep class org.maplibre.reactnative.** { *; }",
  "-keep class com.mrousavy.camera.** { *; }",
  "-keep class com.reactnativegooglesignin.** { *; }",
]

const buildProperties = pluginOptions(
  appConfigForVariant(undefined),
  "expo-build-properties",
  "no expo-build-properties entry in the app config",
)
const android = (buildProperties.android ?? {}) as Record<string, unknown>

test("T5: release builds keep MapLibre, Vision Camera and Google sign-in through R8", () => {
  const rules = android.extraProguardRules
  assert.equal(typeof rules, "string")
  const lines = (rules as string).split("\n").map((line) => line.trim())
  for (const rule of KEEP_RULES) assert.ok(lines.includes(rule), rule)
})

test("T6: R8 stays on in release builds", () => {
  assert.ok(
    android.enableMinifyInReleaseBuilds === undefined ||
      android.enableMinifyInReleaseBuilds === true,
  )
  assert.equal("enableProguardInReleaseBuilds" in android, false)
})

test("T7: the iOS build properties are unchanged", () => {
  const ios = buildProperties.ios as Record<string, unknown>
  assert.equal(ios.deploymentTarget, "16.4")
  assert.equal(ios.buildReactNativeFromSource, false)
  assert.deepEqual(ios.extraPods, [
    { name: "GoogleUtilities", modular_headers: true },
    { name: "RecaptchaInterop", modular_headers: true },
  ])
})

test("T8: no config plugin edits AppDelegate, so SDK 58's generated SceneDelegate stands", () => {
  const dir = fileURLToPath(new URL("../plugins/", import.meta.url).href)
  const names = readdirSync(dir)
  assert.ok(names.length > 0)
  for (const name of names) {
    assert.doesNotMatch(readFileSync(join(dir, name), "utf8"), /AppDelegate/, name)
  }
})
