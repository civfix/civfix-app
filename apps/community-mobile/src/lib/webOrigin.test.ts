import { test } from "node:test"
import assert from "node:assert/strict"
import { PROD_WEB_ORIGIN, resolveWebOrigin } from "./webOrigin.ts"
import { PROD_API_URL, STAGING_API_URL } from "./apiUrl.ts"

test("a build pointed at the staging API shares links to the staging site", () => {
  assert.equal(resolveWebOrigin("https://api.civfix.dev"), "https://civfix.dev")
  assert.equal(resolveWebOrigin("https://api.civfix.dev/v1"), "https://civfix.dev")
})

test("a build pointed at the production API shares links to the production site", () => {
  assert.equal(resolveWebOrigin("https://api.civfix.org"), PROD_WEB_ORIGIN)
  assert.equal(resolveWebOrigin("https://api.civfix.org/"), PROD_WEB_ORIGIN)
})

test("a local or unrecognised API falls back to the production site", () => {
  assert.equal(resolveWebOrigin("http://localhost:8080"), PROD_WEB_ORIGIN)
  assert.equal(resolveWebOrigin("https://civfix.org"), PROD_WEB_ORIGIN)
  assert.equal(resolveWebOrigin("not a url"), PROD_WEB_ORIGIN)
})

test("every API base URL the resolver can choose has a mapped share origin", () => {
  assert.equal(resolveWebOrigin(STAGING_API_URL), "https://civfix.dev")
  assert.equal(resolveWebOrigin(PROD_API_URL), PROD_WEB_ORIGIN)
})

test("never reflects an arbitrary api.* host into a trusted link origin", () => {
  assert.equal(resolveWebOrigin("https://api.evil.com"), PROD_WEB_ORIGIN)
  assert.equal(resolveWebOrigin("https://api.civfix.org.evil.com"), PROD_WEB_ORIGIN)
  assert.equal(resolveWebOrigin("https://api.civfix.dev:8443"), "https://civfix.dev")
})
