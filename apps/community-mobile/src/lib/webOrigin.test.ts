import { test } from "node:test"
import assert from "node:assert/strict"
import { PROD_WEB_ORIGIN, resolveWebOrigin } from "./webOrigin.ts"

test("a build pointed at the staging API shares links to the staging site", () => {
  assert.equal(resolveWebOrigin("https://api.civfix.dev"), "https://civfix.dev")
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
