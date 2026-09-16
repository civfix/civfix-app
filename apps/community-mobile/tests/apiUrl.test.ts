/**
 * API base-URL resolution (src/config.ts `resolveApiUrl`).
 *
 * These exist because of a shipped outage: `app.config.js` set
 * `apiUrl: process.env.EXPO_PUBLIC_API_URL ?? null`, and Expo baked that null into
 * EXConstants.bundle/app.config as `{}` rather than as null. The old resolution was
 * `extra.apiUrl ?? (__DEV__ ? DEV : PROD)`, and `{} ?? fallback` does NOT fall through - `??` only
 * triggers on null/undefined - so API_URL resolved to an OBJECT and every request URL became
 * "[object Object]/v1/...". The build could not reach the backend at all; web was unaffected because
 * it carries its own config.
 *
 * The `{}` case below is the regression guard. The rest pin the surrounding contract so a future
 * "simplification" back to `??` fails loudly here instead of in TestFlight.
 */

import { test } from "node:test"
import assert from "node:assert/strict"
import { resolveApiUrl, DEV_API_URL, PROD_API_URL } from "../src/lib/apiUrl.ts"

test("an empty object from the baked config falls back - the shipped-outage case", () => {
  // `??` would have returned the object here. Everything else in this file is scaffolding; this is
  // the assertion that actually encodes the incident.
  assert.equal(resolveApiUrl({}, false, false), PROD_API_URL)
  assert.equal(resolveApiUrl({}, true, false), DEV_API_URL)
})

test("a configured string wins in both environments", () => {
  assert.equal(resolveApiUrl("https://staging.example.org", false, false), "https://staging.example.org")
  assert.equal(resolveApiUrl("https://staging.example.org", true, false), "https://staging.example.org")
})

test("null and undefined fall back to the environment default", () => {
  assert.equal(resolveApiUrl(null, false, false), PROD_API_URL)
  assert.equal(resolveApiUrl(undefined, false, false), PROD_API_URL)
  assert.equal(resolveApiUrl(null, true, false), DEV_API_URL)
  assert.equal(resolveApiUrl(undefined, true, false), DEV_API_URL)
})

test("empty and whitespace-only strings fall back rather than producing a bare-path URL", () => {
  assert.equal(resolveApiUrl("", false, false), PROD_API_URL)
  assert.equal(resolveApiUrl("   ", false, false), PROD_API_URL)
})

test("a non-string of any shape falls back", () => {
  for (const bogus of [0, 1, true, false, [], { url: "x" }, () => "x"]) {
    assert.equal(resolveApiUrl(bogus, false, false), PROD_API_URL)
  }
})

test("surrounding whitespace is trimmed off a real value", () => {
  assert.equal(resolveApiUrl("  https://api.civfix.org  ", false, false), "https://api.civfix.org")
})

test("a release build never resolves to localhost, and a dev build never to production", () => {
  // The direction of the fallback is the other half of the contract: getting it backwards would ship
  // a TestFlight build pointed at localhost, which is the same user-visible failure.
  assert.equal(resolveApiUrl(undefined, false, false), "https://api.civfix.org")
  assert.equal(resolveApiUrl(undefined, true, false), "http://localhost:8080")
})

test("an unbaked release installed from TestFlight resolves to the staging API", () => {
  assert.equal(resolveApiUrl(undefined, false, true), "https://api.civfix.dev")
})

test("an unbaked release installed from the App Store resolves to the production API", () => {
  assert.equal(resolveApiUrl(undefined, false, false), PROD_API_URL)
})

test("a dev build stays on localhost even when the install looks like a beta one", () => {
  assert.equal(resolveApiUrl(undefined, true, true), DEV_API_URL)
  assert.equal(resolveApiUrl(null, true, true), DEV_API_URL)
  assert.equal(resolveApiUrl({}, true, true), DEV_API_URL)
})

test("a baked URL still wins over the runtime install signal", () => {
  assert.equal(resolveApiUrl("https://api.civfix.dev", false, false), "https://api.civfix.dev")
  assert.equal(resolveApiUrl("https://api.civfix.org", false, true), "https://api.civfix.org")
})
