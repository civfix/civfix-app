import { test } from "node:test"
import assert from "node:assert/strict"
import type { AppConfigResponse } from "@civfix/contract"
import { forceUpdateFor, isBelowMinimum, usableStoreUrl } from "./forceUpdate.ts"

const PLAY_URL = "https://play.google.com/store/apps/details?id=org.civfix.community"

function config(overrides: {
  minAppVersion?: AppConfigResponse["minAppVersion"]
  storeUrl?: AppConfigResponse["storeUrl"]
}): AppConfigResponse {
  return {
    minAppVersion: overrides.minAppVersion ?? { ios: null, android: null },
    storeUrl: overrides.storeUrl ?? { ios: null, android: PLAY_URL },
    announcement: null,
  }
}

test("T1: a version below the minimum is below it", () => {
  assert.equal(isBelowMinimum("1.4.0", "1.5.0"), true)
})

test("T2: the minimum itself is not below it", () => {
  assert.equal(isBelowMinimum("1.4.0", "1.4.0"), false)
})

test("T3: a version above the minimum is not below it", () => {
  assert.equal(isBelowMinimum("1.4.0", "1.3.9"), false)
  assert.equal(isBelowMinimum("2.0.0", "1.99.99"), false)
})

test("T4: parts compare as numbers, not as text", () => {
  assert.equal(isBelowMinimum("1.9.0", "1.10.0"), true)
  assert.equal(isBelowMinimum("1.10.0", "1.9.0"), false)
})

test("T5: no minimum never blocks", () => {
  assert.equal(isBelowMinimum("1.4.0", null), false)
})

test("T6: a malformed minimum never blocks", () => {
  for (const minimum of ["1.5", "1.5.0-beta", "v1.5.0", "abc", "", " 1.5.0x"]) {
    assert.equal(isBelowMinimum("1.4.0", minimum), false, JSON.stringify(minimum))
  }
})

test("T7: a malformed or missing own version never blocks", () => {
  for (const own of [undefined, null, "1.4", "dev"]) {
    assert.equal(isBelowMinimum(own, "999.0.0"), false, JSON.stringify(own))
  }
})

test("T8: an App Store or Google Play https URL is used unchanged", () => {
  for (const url of ["https://apps.apple.com/us/app/civfix/id6740000000", PLAY_URL]) {
    assert.equal(usableStoreUrl(url), url)
  }
})

test("T9: anything that does not start with a store's exact https prefix is not used", () => {
  for (const url of [
    null,
    "",
    "http://apps.apple.com/us/app/x",
    "https://apps.apple.com.evil.example/x",
    "https://evil.example/https://play.google.com/",
    "itms-apps://apps.apple.com/app/x",
    "HTTPS://APPS.APPLE.COM/x",
  ]) {
    assert.equal(usableStoreUrl(url), null, JSON.stringify(url))
  }
})

test("T10: an Android build below the Android minimum is blocked with the Play URL", () => {
  const decision = forceUpdateFor(config({ minAppVersion: { ios: null, android: "1.5.0" } }), "android", "1.4.0")
  assert.deepEqual(decision, { blocked: true, storeUrl: PLAY_URL })
})

test("T11: an iOS build below the iOS minimum with no App Store URL is blocked without a URL", () => {
  const decision = forceUpdateFor(
    config({ minAppVersion: { ios: "1.5.0", android: null }, storeUrl: { ios: null, android: PLAY_URL } }),
    "ios",
    "1.4.0",
  )
  assert.deepEqual(decision, { blocked: true, storeUrl: null })
})

test("T12: only the build's own platform minimum counts", () => {
  const decision = forceUpdateFor(config({ minAppVersion: { ios: null, android: "9.0.0" } }), "ios", "1.4.0")
  assert.deepEqual(decision, { blocked: false })
})

test("T13: no config (pending, failed or unparsable) never blocks", () => {
  assert.deepEqual(forceUpdateFor(undefined, "android", "1.4.0"), { blocked: false })
  assert.deepEqual(forceUpdateFor(undefined, "ios", "1.4.0"), { blocked: false })
})

test("T14: a cleared minimum unblocks", () => {
  const decision = forceUpdateFor(config({ minAppVersion: { ios: null, android: null } }), "android", "1.4.0")
  assert.deepEqual(decision, { blocked: false })
})

test("T15: a store URL that is not a store's is dropped, and the build stays blocked", () => {
  const decision = forceUpdateFor(
    config({
      minAppVersion: { ios: null, android: "1.5.0" },
      storeUrl: { ios: null, android: "https://evil.example/app" },
    }),
    "android",
    "1.4.0",
  )
  assert.deepEqual(decision, { blocked: true, storeUrl: null })
})
