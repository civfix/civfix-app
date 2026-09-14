import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { test } from "node:test"
import { decodeRgbaPng, pixelAt, transparentShare } from "./helpers/png.ts"

const require = createRequire(import.meta.url)
const appConfig = require("../app.config.js")({ config: {} })

const appDir = new URL("../", import.meta.url)
const SPLASH_SOURCE = "./assets/splash.png"
const MIN_TRANSPARENT_SHARE = 0.6
const IMAGESET = new URL("ios/civfix/Images.xcassets/SplashScreenLogo.imageset/", appDir)

function load(relative: string) {
  return decodeRgbaPng(readFileSync(fileURLToPath(new URL(relative, appDir))))
}

function splashPluginOptions(): Record<string, any> {
  const entry = appConfig.plugins.find(
    (plugin: unknown) => Array.isArray(plugin) && plugin[0] === "expo-splash-screen",
  )
  assert.ok(Array.isArray(entry), "expo-splash-screen plugin tuple")
  return entry[1]
}

function assertTransparentCorners(png: ReturnType<typeof load>, label: string) {
  const { width, height } = png
  const probes: [string, number, number][] = [
    ["top-left", 0, 0],
    ["top-right", width - 1, 0],
    ["bottom-left", 0, height - 1],
    ["bottom-right", width - 1, height - 1],
    ["left edge midpoint", Math.round(width * 0.02), Math.round(height * 0.5)],
  ]
  for (const [where, x, y] of probes) {
    assert.equal(pixelAt(png, x, y).a, 0, `${label}: ${where} must be fully transparent`)
  }
}

test("the splash asset is an 8-bit non-interlaced RGBA png", () => {
  const png = load(SPLASH_SOURCE)
  assert.ok(png.width > 0 && png.height > 0)
  assert.equal(png.pixels.length, png.width * png.height * 4)
})

test("the splash asset has no baked background behind the logo", () => {
  const png = load(SPLASH_SOURCE)
  assertTransparentCorners(png, SPLASH_SOURCE)
  const share = transparentShare(png, 8)
  assert.ok(
    share >= MIN_TRANSPARENT_SHARE,
    `${SPLASH_SOURCE} is only ${(share * 100).toFixed(1)}% transparent; a baked background boxes the logo on the launch screen`,
  )
})

test("both appearances point at the transparent splash asset", () => {
  const plugin = splashPluginOptions()
  const references = [
    appConfig.splash.image,
    appConfig.splash.dark.image,
    plugin.image,
    plugin.dark.image,
  ]
  for (const reference of references) {
    assert.equal(reference, SPLASH_SOURCE)
    assertTransparentCorners(load(reference), reference)
  }
})

const imagesetPresent = existsSync(fileURLToPath(IMAGESET))

test(
  "the generated ios imageset carries the transparent logo, not a stale opaque prebuild",
  { skip: imagesetPresent ? false : "no local ios/ prebuild" },
  () => {
    for (const name of ["image@3x.png", "dark_image@3x.png"]) {
      const png = decodeRgbaPng(readFileSync(fileURLToPath(new URL(name, IMAGESET))))
      assertTransparentCorners(png, `SplashScreenLogo.imageset/${name}`)
    }
  },
)
