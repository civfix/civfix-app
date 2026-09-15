import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { test } from "node:test"
import { tokens } from "@civfix/shared/tokens"

const require = createRequire(import.meta.url)
const appConfigSource = readFileSync(new URL("../app.config.js", import.meta.url), "utf8")
const appConfig = require("../app.config.js")({ config: {} })
const loadingSplash = readFileSync(
  new URL("../src/components/LoadingSplash.tsx", import.meta.url),
  "utf8",
)
const layout = readFileSync(new URL("../app/_layout.tsx", import.meta.url), "utf8")
const launchThemeModule = readFileSync(
  new URL("../src/boot/launchTheme.ts", import.meta.url),
  "utf8",
)

const LIGHT = tokens.color.neutral.paper

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

test("no dark paper reaches the native splash at all", () => {
  assert.equal(appConfig.splash.dark, undefined)
  assert.equal(splashPlugin().dark, undefined)
  assert.doesNotMatch(appConfigSource, /SPLASH_BG_DARK|darkColor/)
})

test("the android adaptive icon sits on the same light paper", () => {
  assert.equal(appConfig.android.adaptiveIcon.backgroundColor, LIGHT)
})

test("the splash colours are derived from the contract, never retyped as literals", () => {
  assert.match(appConfigSource, /require\("@civfix\/shared\/tokens"\)/)
  assert.match(appConfigSource, /const SPLASH_BG_LIGHT = tokens\.color\.neutral\.paper/)
  for (const [, value] of appConfigSource.matchAll(/backgroundColor: ([^,\n]+)/g)) {
    assert.equal(value, "SPLASH_BG_LIGHT")
  }
})

test("the launch theme is the light scheme, resolved from the shared theme", () => {
  assert.match(launchThemeModule, /export const LAUNCH_SCHEME: ColorSchemeName = "light"/)
  assert.match(launchThemeModule, /export const launchTheme: Theme = themeFor\(LAUNCH_SCHEME\)/)
})

test("the JS boot screen paints the flat launch background, never a wash over it", () => {
  const root = loadingSplash.slice(loadingSplash.indexOf("  root: {"))
  assert.match(root, /backgroundColor: t\.colors\.bg/)
  assert.match(loadingSplash, /\}\)\)\.for\(LAUNCH_SCHEME\)/)
  assert.doesNotMatch(loadingSplash, /RadialGradient|LinearGradient|react-native-svg/)
  assert.doesNotMatch(loadingSplash, /StyleSheet\.absoluteFill[^O]/)
})

test("the native root view sits on the launch paper before the first paint, the app's after", () => {
  assert.match(layout, /import \* as SystemUI from "expo-system-ui"/)
  assert.match(layout, /void SystemUI\.setBackgroundColorAsync\(launchTheme\.colors\.bg\)/)
  assert.match(layout, /void SystemUI\.setBackgroundColorAsync\(t\.colors\.bg\)/)
})
