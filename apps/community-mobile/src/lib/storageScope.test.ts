import { test } from "node:test"
import assert from "node:assert/strict"
import { scopeStorageId, storageNamespace } from "./storageScope.ts"
import { DEV_API_URL, PROD_API_URL, STAGING_API_URL } from "./apiUrl.ts"

test("a production build keeps the legacy ids, so an existing install is not signed out", () => {
  assert.equal(storageNamespace(PROD_API_URL), "")
  assert.equal(scopeStorageId("civfix.app", PROD_API_URL), "civfix.app")
  assert.equal(scopeStorageId("civfix.session.token", PROD_API_URL), "civfix.session.token")
  assert.equal(scopeStorageId("civfix.secure", PROD_API_URL), "civfix.secure")
})

test("a trailing slash or stray whitespace is still production", () => {
  assert.equal(scopeStorageId("civfix.app", "https://api.civfix.org/"), "civfix.app")
  assert.equal(scopeStorageId("civfix.app", "  https://api.civfix.org  "), "civfix.app")
  assert.equal(scopeStorageId("civfix.app", "https://api.civfix.org/v1"), "civfix.app")
})

test("a staging build gets its own namespace", () => {
  assert.equal(storageNamespace(STAGING_API_URL), "api-civfix-dev")
  assert.equal(scopeStorageId("civfix.app", STAGING_API_URL), "civfix.app.api-civfix-dev")
  assert.equal(
    scopeStorageId("civfix.session.token", STAGING_API_URL),
    "civfix.session.token.api-civfix-dev",
  )
})

test("a local dev build is namespaced too, port included", () => {
  assert.equal(storageNamespace(DEV_API_URL), "localhost-8080")
  assert.equal(scopeStorageId("civfix.app", DEV_API_URL), "civfix.app.localhost-8080")
})

test("every API base URL the resolver can choose maps to a distinct namespace", () => {
  const namespaces = [DEV_API_URL, STAGING_API_URL, PROD_API_URL].map(storageNamespace)
  assert.equal(new Set(namespaces).size, namespaces.length)
})

test("an unrecognised or unparseable base URL never borrows the production namespace", () => {
  for (const bogus of ["", "   ", "not a url", "https://api.evil.com", "https://api.civfix.org.evil.com"]) {
    assert.notEqual(storageNamespace(bogus), "")
  }
})
