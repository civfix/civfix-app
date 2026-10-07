import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import { appConfigFactory } from "./helpers/appConfig.ts"

const LOWEST_UNCLAIMED_VERSION_CODE = 8

afterEach(() => {
  delete process.env.CIVFIX_ANDROID_VERSION_CODE
})

test("android.versionCode defaults to the lowest code no upload has claimed", () => {
  delete process.env.CIVFIX_ANDROID_VERSION_CODE
  assert.equal(appConfigFactory({ config: {} }).android.versionCode, LOWEST_UNCLAIMED_VERSION_CODE)
})

test("CIVFIX_ANDROID_VERSION_CODE sets the version code a release build carries", () => {
  process.env.CIVFIX_ANDROID_VERSION_CODE = "42"
  assert.equal(appConfigFactory({ config: {} }).android.versionCode, 42)
})

test("a version code Play has already consumed, or one that is not a whole number, is refused", () => {
  for (const bad of ["7", "8.5", "seven", "-1"]) {
    process.env.CIVFIX_ANDROID_VERSION_CODE = bad
    assert.throws(() => appConfigFactory({ config: {} }), /CIVFIX_ANDROID_VERSION_CODE must be a whole number >= 8/)
  }
})
