import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { afterEach, test } from "node:test"

const require = createRequire(import.meta.url)
const buildConfig = require("../app.config.js") as (ctx: { config: object }) => { android: { versionCode: number } }

const LOWEST_UNCLAIMED_VERSION_CODE = 8

afterEach(() => {
  delete process.env.CIVFIX_ANDROID_VERSION_CODE
})

test("android.versionCode defaults to the lowest code no upload has claimed", () => {
  delete process.env.CIVFIX_ANDROID_VERSION_CODE
  assert.equal(buildConfig({ config: {} }).android.versionCode, LOWEST_UNCLAIMED_VERSION_CODE)
})

test("CIVFIX_ANDROID_VERSION_CODE sets the version code a release build carries", () => {
  process.env.CIVFIX_ANDROID_VERSION_CODE = "42"
  assert.equal(buildConfig({ config: {} }).android.versionCode, 42)
})

test("a version code Play has already consumed, or one that is not a whole number, is refused", () => {
  for (const bad of ["7", "8.5", "seven", "-1"]) {
    process.env.CIVFIX_ANDROID_VERSION_CODE = bad
    assert.throws(() => buildConfig({ config: {} }), /CIVFIX_ANDROID_VERSION_CODE must be a whole number >= 8/)
  }
})
