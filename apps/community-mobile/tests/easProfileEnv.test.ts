import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { URL } from "node:url"

import { profileEnv, resolveProfile } from "../scripts/eas-profile-env.mjs"

interface BuildProfile {
  extends?: string
  channel?: string
  env?: Record<string, string>
}

const eas = JSON.parse(readFileSync(new URL("../eas.json", import.meta.url), "utf8")) as {
  build: Record<string, BuildProfile>
}

test("the Android internal build (testflight profile) bakes the staging API and the testflight channel", () => {
  const env = profileEnv(eas, "testflight")
  assert.equal(env.EXPO_PUBLIC_API_URL, "https://api.civfix.dev")
  assert.equal(env.CIVFIX_UPDATE_CHANNEL, "testflight")
})

test("the production profile bakes no API URL, so the app resolves production at runtime", () => {
  const env = profileEnv(eas, "production")
  assert.equal("EXPO_PUBLIC_API_URL" in env, false)
  assert.equal(env.CIVFIX_UPDATE_CHANNEL, "production")
})

test("note keys never become environment variables", () => {
  for (const name of ["testflight", "production"]) {
    assert.deepEqual(Object.keys(profileEnv(eas, name)).filter((key) => !/^[A-Z_][A-Z0-9_]*$/.test(key)), [])
  }
})

test("extends is resolved and a cycle or an unknown profile is refused", () => {
  const fixture = { build: { a: { env: { X: "1" } }, b: { extends: "a", env: { Y: "2" } }, c: { extends: "c" } } }
  assert.deepEqual((resolveProfile(fixture, "b") as BuildProfile).env, { X: "1", Y: "2" })
  assert.throws(() => resolveProfile(fixture, "c"), /extends itself/)
  assert.throws(() => resolveProfile(fixture, "missing"), /no build profile 'missing'/)
})
