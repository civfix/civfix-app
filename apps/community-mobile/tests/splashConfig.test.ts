import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { test } from "node:test"
import { tokens, darkColor } from "@civfix/shared/tokens"

const require = createRequire(import.meta.url)
const appConfig = require("../app.config.js")({ config: {} })
const appDir = new URL("../", import.meta.url)

const LIGHT = tokens.color.neutral.paper
const DARK = darkColor.neutral.paper

function splashPlugin(): Record<string, any> {
  const entry = appConfig.plugins.find(
    (plugin: unknown) => Array.isArray(plugin) && plugin[0] === "expo-splash-screen",
  )
  assert.ok(Array.isArray(entry), "app.config.js declares no expo-splash-screen plugin tuple")
  return entry[1]
}

test("the app follows the device appearance, so the launch screen can too", () => {
  assert.equal(
    appConfig.userInterfaceStyle,
    "automatic",
    "anything but automatic pins the launch screen to a single appearance",
  )
})

test("the resolved splash backgrounds are the paper tokens, light and dark", () => {
  assert.equal(appConfig.splash.backgroundColor, LIGHT)
  assert.equal(appConfig.splash.dark.backgroundColor, DARK)
})

test("the expo-splash-screen plugin carries its own dark block, not expo's dropped fallback", () => {
  const plugin = splashPlugin()
  assert.ok(
    plugin.dark !== null && typeof plugin.dark === "object",
    "iOS silently drops the top-level splash.dark; only the plugin's own dark block is baked",
  )
  assert.equal(plugin.backgroundColor, LIGHT)
  assert.equal(plugin.dark.backgroundColor, DARK)
  assert.notEqual(plugin.dark.backgroundColor, plugin.backgroundColor)
})

test("every splash image the config names is a file that exists", () => {
  const plugin = splashPlugin()
  const references = [
    appConfig.splash.image,
    appConfig.splash.dark.image,
    plugin.image,
    plugin.dark.image,
  ]
  for (const reference of references) {
    assert.equal(typeof reference, "string", "a splash image reference is missing")
    assert.ok(
      existsSync(fileURLToPath(new URL(reference, appDir))),
      `${reference} is referenced by app.config.js but does not exist`,
    )
  }
})
