import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { test } from "node:test"
import { tokens, darkColor } from "@civfix/shared/tokens"
import { decodeRgbaPng, pixelAt, transparentShare } from "./helpers/png.ts"

const require = createRequire(import.meta.url)
const appConfig = require("../app.config.js")({ config: {} })

const appDir = new URL("../", import.meta.url)
const SPLASH_SOURCE = "./assets/splash.png"
const MIN_TRANSPARENT_SHARE = 0.6
const IMAGESET = new URL("ios/civfix/Images.xcassets/SplashScreenLogo.imageset/", appDir)
const COLORSET = new URL(
  "ios/civfix/Images.xcassets/SplashScreenBackground.colorset/Contents.json",
  appDir,
)
const STORYBOARD = new URL("ios/civfix/SplashScreen.storyboard", appDir)
const INFO_PLIST = new URL("ios/civfix/Info.plist", appDir)
const LIGHT = tokens.color.neutral.paper
const DARK = darkColor.neutral.paper

function load(relative: string) {
  return decodeRgbaPng(readFileSync(fileURLToPath(new URL(relative, appDir))))
}

function readGenerated(url: URL): string {
  return readFileSync(fileURLToPath(url), "utf8")
}

function isDarkEntry(entry: { appearances?: { appearance: string; value: string }[] }): boolean {
  return (entry.appearances ?? []).some(
    (appearance) => appearance.appearance === "luminosity" && appearance.value === "dark",
  )
}

function assertComponents(components: Record<string, string>, hex: string, label: string) {
  const channels: [string, number][] = ["red", "green", "blue"].map((channel, at) => [
    channel,
    parseInt(hex.replace("#", "").slice(at * 2, at * 2 + 2), 16) / 255,
  ])
  for (const [channel, expected] of channels) {
    assert.ok(
      Math.abs(Number(components[channel]) - expected) < 1e-6,
      `${label}: ${channel} is ${components[channel]}, expected ${expected} (${hex})`,
    )
  }
  assert.equal(Number(components.alpha), 1, `${label}: alpha must be opaque`)
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

const skipWithoutPrebuild = existsSync(fileURLToPath(IMAGESET)) ? false : "no local ios/ prebuild"

test(
  "the generated ios imageset carries the transparent logo, not a stale opaque prebuild",
  { skip: skipWithoutPrebuild },
  () => {
    for (const name of ["image@3x.png", "dark_image@3x.png"]) {
      const png = decodeRgbaPng(readFileSync(fileURLToPath(new URL(name, IMAGESET))))
      assertTransparentCorners(png, `SplashScreenLogo.imageset/${name}`)
    }
  },
)

test(
  "the generated ios background colorset carries both paper appearances",
  { skip: skipWithoutPrebuild },
  () => {
    const { colors } = JSON.parse(readGenerated(COLORSET))
    const light = colors.find((entry: Record<string, any>) => !isDarkEntry(entry))
    const dark = colors.find(isDarkEntry)
    assert.ok(light, "SplashScreenBackground has no default appearance")
    assert.ok(
      dark,
      "SplashScreenBackground has no dark appearance; the launch screen cannot follow the device",
    )
    assertComponents(light.color.components, LIGHT, "SplashScreenBackground light")
    assertComponents(dark.color.components, DARK, "SplashScreenBackground dark")
  },
)

test(
  "the generated ios imageset carries a dark logo entry at every scale",
  { skip: skipWithoutPrebuild },
  () => {
    const { images } = JSON.parse(readGenerated(new URL("Contents.json", IMAGESET)))
    const dark = images.filter(isDarkEntry)
    assert.deepEqual(
      dark.map((entry: Record<string, any>) => entry.scale).sort(),
      ["1x", "2x", "3x"],
      "SplashScreenLogo is missing a dark appearance at some scale",
    )
    for (const entry of dark) assert.match(entry.filename, /^dark_image/)
  },
)

test(
  "the generated storyboard binds its background to the named colour asset",
  { skip: skipWithoutPrebuild },
  () => {
    const storyboard = readGenerated(STORYBOARD)
    assert.match(
      storyboard,
      /<color key="backgroundColor" name="SplashScreenBackground"\/>/,
      "the container view must reference the colorset by name, or the appearance never switches",
    )
  },
)

test(
  "the generated Info.plist lets the launch screen follow the device appearance",
  { skip: skipWithoutPrebuild },
  () => {
    const plist = readGenerated(INFO_PLIST)
    assert.match(plist, /<key>UIUserInterfaceStyle<\/key>\s*<string>Automatic<\/string>/)
    assert.match(plist, /<key>UILaunchStoryboardName<\/key>\s*<string>SplashScreen<\/string>/)
  },
)
