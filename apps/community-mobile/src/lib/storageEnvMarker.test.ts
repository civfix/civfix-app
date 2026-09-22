import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  LEGACY_STORAGE_IDS,
  PROD_STORAGE_ENV,
  STORAGE_ENV_MARKER_KEY,
  purgesLegacyStorage,
  storageEnvFor,
  writesStorageEnvMarker,
} from "./storageEnvMarker.ts"
import { scopeStorageId, storageNamespace } from "./storageScope.ts"
import { DEV_API_URL, PROD_API_URL, STAGING_API_URL } from "./apiUrl.ts"

const PROD = storageNamespace(PROD_API_URL)
const STAGING = storageNamespace(STAGING_API_URL)
const DEV = storageNamespace(DEV_API_URL)

function bootSequence(namespaces: readonly string[], seed: string | null = null) {
  let marker = seed
  const purges: boolean[] = []
  for (const namespace of namespaces) {
    const purged = purgesLegacyStorage(namespace, marker)
    purges.push(purged)
    if (writesStorageEnvMarker(namespace, marker)) marker = storageEnvFor(namespace)
  }
  return { marker, purges }
}

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

test("a TestFlight detour between two App Store boots never wipes the production session", () => {
  const { marker, purges } = bootSequence([PROD, STAGING, PROD])
  assert.deepEqual(purges, [false, false, false])
  assert.equal(marker, PROD_STORAGE_ENV)
})

test("a staging boot leaves an existing production marker alone, whatever it detours through", () => {
  assert.equal(writesStorageEnvMarker(STAGING, PROD_STORAGE_ENV), false)
  assert.equal(writesStorageEnvMarker(DEV, PROD_STORAGE_ENV), false)
  assert.equal(writesStorageEnvMarker(STAGING, storageEnvFor(DEV)), false)
  assert.deepEqual(bootSequence([PROD, STAGING, DEV, STAGING, PROD]).purges, [
    false,
    false,
    false,
    false,
    false,
  ])
})

test("old TestFlight residue still purges: no marker means the first staging boot claims it", () => {
  assert.equal(writesStorageEnvMarker(STAGING, null), true)
  assert.equal(writesStorageEnvMarker(STAGING, ""), true)
  const { marker, purges } = bootSequence([STAGING, PROD])
  assert.equal(marker, PROD_STORAGE_ENV)
  assert.deepEqual(purges, [false, true])
})

test("a production boot always records itself, including the one that just purged", () => {
  assert.equal(writesStorageEnvMarker(PROD, null), true)
  assert.equal(writesStorageEnvMarker(PROD, storageEnvFor(STAGING)), true)
  assert.equal(writesStorageEnvMarker(PROD, PROD_STORAGE_ENV), false)
  assert.equal(writesStorageEnvMarker(STAGING, storageEnvFor(STAGING)), false)
})

test("the boot path decides the write through that policy, not through a bare marker comparison", () => {
  const source = readFileSync(new URL("./legacyStorageReset.ts", import.meta.url), "utf8")
  assert.match(source, /writesStorageEnvMarker\(namespace, marker\)/)
  assert.doesNotMatch(source, /marker !== next/)
})

test("the marker key is never namespaced, so it survives the environment flip it reports", () => {
  assert.equal(STORAGE_ENV_MARKER_KEY, "civfix.storage.env")
  assert.ok(!STORAGE_ENV_MARKER_KEY.endsWith(STAGING))
})
