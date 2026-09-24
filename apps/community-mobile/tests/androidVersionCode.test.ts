import assert from "node:assert/strict"
import { test } from "node:test"
import { appConfigFactory } from "./helpers/appConfig.ts"

const appConfig = appConfigFactory({ config: {} })

const LOWEST_UNUSED_PLAY_VERSION_CODE = 6

test("android.versionCode is a whole number no Play upload has consumed", () => {
  const { versionCode } = appConfig.android
  assert.equal(
    Number.isInteger(versionCode),
    true,
    `android.versionCode must be an integer, got ${JSON.stringify(versionCode)}`,
  )
  assert.ok(
    versionCode >= LOWEST_UNUSED_PLAY_VERSION_CODE,
    `android.versionCode ${versionCode} is already taken - builds 4 and 5 shipped from hand edits to the gitignored android/, so Play rejects anything below ${LOWEST_UNUSED_PLAY_VERSION_CODE}`,
  )
})
