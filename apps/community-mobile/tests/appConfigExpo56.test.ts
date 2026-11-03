import assert from "node:assert/strict"
import { test } from "node:test"
import { appConfigForVariant } from "./helpers/appConfig.ts"

const appConfig = appConfigForVariant(undefined)

test("T1: the app config carries no newArchEnabled, which SDK 55 removed with the legacy architecture", () => {
  assert.equal("newArchEnabled" in appConfig, false)
})

test("T3: the app config adds no expo-navigation-bar config plugin", () => {
  const names = appConfig.plugins.map((entry): unknown =>
    Array.isArray(entry) ? (entry as unknown[])[0] : entry,
  )
  assert.equal(names.includes("expo-navigation-bar"), false)
})
