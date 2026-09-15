import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { test } from "node:test"
import { tokens } from "@civfix/shared/tokens"

const require = createRequire(import.meta.url)
const appConfig = require("../app.config.js")({ config: {} })
const appDir = new URL("../", import.meta.url)

const LIGHT = tokens.color.neutral.paper

function splashPlugin(): Record<string, any> {
  const entry = appConfig.plugins.find(
    (plugin: unknown) => Array.isArray(plugin) && plugin[0] === "expo-splash-screen",
  )
  assert.ok(Array.isArray(entry), "app.config.js declares no expo-splash-screen plugin tuple")
  return entry[1]
}

test("the app itself still follows the device appearance", () => {
  assert.equal(
    appConfig.userInterfaceStyle,
    "automatic",
    "the launch screen is light-only, but the app proper must keep following the device",
  )
})

test("the splash background is the light paper token and nothing else", () => {
  assert.equal(appConfig.splash.backgroundColor, LIGHT)
  assert.equal(
    appConfig.splash.dark,
    undefined,
    "a dark splash block puts the launch screen back on two appearances",
  )
})

test("the expo-splash-screen plugin bakes one appearance, the light one", () => {
  const plugin = splashPlugin()
  assert.equal(plugin.backgroundColor, LIGHT)
  assert.equal(
    plugin.dark,
    undefined,
    "the plugin's dark block is what the prebuild bakes; it must be gone",
  )
})

test("the android splash and adaptive icon sit on the same single light field", () => {
  assert.equal(appConfig.android.adaptiveIcon.backgroundColor, LIGHT)
  assert.equal(appConfig.android.adaptiveIcon.dark, undefined)
  assert.equal(appConfig.android.splash, undefined)
})

test("every splash image the config names is a file that exists", () => {
  const references = [appConfig.splash.image, splashPlugin().image]
  for (const reference of references) {
    assert.equal(typeof reference, "string", "a splash image reference is missing")
    assert.ok(
      existsSync(fileURLToPath(new URL(reference, appDir))),
      `${reference} is referenced by app.config.js but does not exist`,
    )
  }
})
