import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { test } from "node:test"
import { tokens, darkColor } from "@civfix/shared/tokens"

const require = createRequire(import.meta.url)
const appConfigSource = readFileSync(new URL("../app.config.js", import.meta.url), "utf8")
const appConfig = require("../app.config.js")({ config: {} })

const LIGHT = tokens.color.neutral.paper
const DARK = darkColor.neutral.paper

function splashPlugin(): Record<string, any> {
  const entry = appConfig.plugins.find(
    (plugin: unknown) => Array.isArray(plugin) && plugin[0] === "expo-splash-screen",
  )
  assert.ok(Array.isArray(entry), "expo-splash-screen plugin tuple")
  return entry[1]
}

test("the native splash background is the light paper token", () => {
  assert.equal(appConfig.splash.backgroundColor, LIGHT)
  assert.equal(splashPlugin().backgroundColor, LIGHT)
})

test("the dark native splash background is the dark paper token", () => {
  assert.equal(appConfig.splash.dark.backgroundColor, DARK)
  assert.equal(splashPlugin().dark.backgroundColor, DARK)
})

test("the android adaptive icon sits on the same light paper", () => {
  assert.equal(appConfig.android.adaptiveIcon.backgroundColor, LIGHT)
})

test("the splash colours are derived from the contract, never retyped as literals", () => {
  assert.match(appConfigSource, /require\("@civfix\/shared\/tokens"\)/)
  assert.match(appConfigSource, /const SPLASH_BG_LIGHT = tokens\.color\.neutral\.paper/)
  assert.match(appConfigSource, /const SPLASH_BG_DARK = darkColor\.neutral\.paper/)
  for (const [, value] of appConfigSource.matchAll(/backgroundColor: ([^,\n]+)/g)) {
    assert.match(value, /^SPLASH_BG_(LIGHT|DARK)$/)
  }
})
