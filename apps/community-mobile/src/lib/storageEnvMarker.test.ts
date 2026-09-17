import { test } from "node:test"
import assert from "node:assert/strict"
import {
  LEGACY_STORAGE_IDS,
  PROD_STORAGE_ENV,
  STORAGE_ENV_MARKER_KEY,
  purgesLegacyStorage,
  storageEnvFor,
} from "./storageEnvMarker.ts"
import { scopeStorageId, storageNamespace } from "./storageScope.ts"
import { DEV_API_URL, PROD_API_URL, STAGING_API_URL } from "./apiUrl.ts"

const PROD = storageNamespace(PROD_API_URL)
const STAGING = storageNamespace(STAGING_API_URL)
const DEV = storageNamespace(DEV_API_URL)

test("the marker names production explicitly, so an absent marker stays distinguishable from it", () => {
  assert.equal(storageEnvFor(PROD), PROD_STORAGE_ENV)
  assert.notEqual(storageEnvFor(PROD), "")
  assert.equal(storageEnvFor(STAGING), STAGING)
  assert.equal(storageEnvFor(DEV), DEV)
})

test("a production boot whose previous run was staging purges the legacy ids", () => {
  assert.equal(purgesLegacyStorage(PROD, storageEnvFor(STAGING)), true)
})

test("a production boot whose previous run was a local dev build purges them too", () => {
  assert.equal(purgesLegacyStorage(PROD, storageEnvFor(DEV)), true)
})

test("a production boot that follows another production run keeps the session", () => {
  assert.equal(purgesLegacyStorage(PROD, PROD_STORAGE_ENV), false)
})

test("a production boot with NO marker keeps the session - that ambiguity is documented, not guessed", () => {
  assert.equal(purgesLegacyStorage(PROD, null), false)
  assert.equal(purgesLegacyStorage(PROD, ""), false)
})

test("a non-production boot never purges: it does not read the legacy ids in the first place", () => {
  for (const namespace of [STAGING, DEV]) {
    assert.equal(purgesLegacyStorage(namespace, PROD_STORAGE_ENV), false)
    assert.equal(purgesLegacyStorage(namespace, storageEnvFor(STAGING)), false)
    assert.equal(purgesLegacyStorage(namespace, null), false)
  }
})

test("every listed legacy id is exactly what a production build resolves to", () => {
  assert.deepEqual(
    [...LEGACY_STORAGE_IDS].sort(),
    ["civfix.app", "civfix.secure", "civfix.secure-blobs.key", "civfix.session.token"],
  )
  for (const id of LEGACY_STORAGE_IDS) {
    assert.equal(scopeStorageId(id, PROD_API_URL), id)
    assert.notEqual(scopeStorageId(id, STAGING_API_URL), id)
  }
})

test("the marker key is never namespaced, so it survives the environment flip it reports", () => {
  assert.equal(STORAGE_ENV_MARKER_KEY, "civfix.storage.env")
  assert.ok(!STORAGE_ENV_MARKER_KEY.endsWith(STAGING))
})
