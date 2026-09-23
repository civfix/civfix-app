import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { test } from "node:test"

const require = createRequire(import.meta.url)
const appConfigFactory = require("../app.config.js") as (input: {
  config: Record<string, unknown>
}) => Record<string, any>

function notificationsPlugin(profile?: string): Record<string, any> {
  const previous = process.env.EAS_BUILD_PROFILE
  if (profile === undefined) delete process.env.EAS_BUILD_PROFILE
  else process.env.EAS_BUILD_PROFILE = profile
  try {
    const entry = appConfigFactory({ config: {} }).plugins.find(
      (plugin: unknown) => Array.isArray(plugin) && plugin[0] === "expo-notifications",
    )
    assert.ok(Array.isArray(entry), "app.config.js declares no expo-notifications plugin tuple")
    return entry[1]
  } finally {
    if (previous === undefined) delete process.env.EAS_BUILD_PROFILE
    else process.env.EAS_BUILD_PROFILE = previous
  }
}

test("a store-bound EAS build bakes the PRODUCTION aps-environment entitlement", () => {
  for (const profile of ["testflight", "production"]) {
    assert.equal(
      notificationsPlugin(profile).mode,
      "production",
      `${profile} must not ship a sandbox aps-environment - APNS drops every push`,
    )
  }
})

test("the internally distributed EAS profiles are signed for production APNS too", () => {
  for (const profile of ["preview", "staging"]) {
    assert.equal(notificationsPlugin(profile).mode, "production", profile)
  }
})

test("the EAS development-client profile keeps the sandbox, and so does a local prebuild", () => {
  assert.equal(notificationsPlugin("development").mode, "development")
  assert.equal(notificationsPlugin(undefined).mode, "development")
})

test("the mode is resolved per config call, never frozen at module load", () => {
  assert.equal(notificationsPlugin("production").mode, "production")
  assert.equal(notificationsPlugin("development").mode, "development")
  assert.equal(notificationsPlugin("production").mode, "production")
})
