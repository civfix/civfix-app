import assert from "node:assert/strict"
import { test } from "node:test"
import { appConfigFactory } from "./helpers/appConfig.ts"

const appConfig = appConfigFactory({ config: {} })

test("T5: the app config declares no OTA updates and no expo-updates plugin", () => {
  assert.equal("updates" in appConfig, false)
  assert.equal("runtimeVersion" in appConfig, false)
  const names = appConfig.plugins.map((entry): unknown => (Array.isArray(entry) ? (entry as unknown[])[0] : entry))
  assert.equal(names.includes("expo-updates"), false)
})

test("T6: push keeps its EAS project id and owner", () => {
  assert.equal(appConfig.extra.eas.projectId, "dea5514a-661e-4148-b099-ffe65443f806")
  assert.equal(appConfig.owner, "civfix-app")
})
