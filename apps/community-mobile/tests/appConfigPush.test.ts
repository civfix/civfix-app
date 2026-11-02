import assert from "node:assert/strict"
import { test } from "node:test"
import { appConfigForVariant, pluginOptions } from "./helpers/appConfig.ts"

test("T33: only the store variant ships google-services.json; both get background remote notifications", () => {
  const store = appConfigForVariant(undefined)
  const dev = appConfigForVariant("development")
  assert.equal(store.android.googleServicesFile, "./google-services.json")
  assert.equal("googleServicesFile" in dev.android, false)
  for (const [name, config] of [
    ["store", store],
    ["development", dev],
  ] as const) {
    const options = pluginOptions(
      config,
      "expo-notifications",
      `${name}: no expo-notifications plugin`,
    )
    assert.equal(options.enableBackgroundRemoteNotifications, true, name)
    assert.equal(config.extra.eas.projectId, "dea5514a-661e-4148-b099-ffe65443f806", name)
  }
})
