import assert from "node:assert/strict"
import { test } from "node:test"

import {
  StoreLookupUnavailable,
  compareAppVersions,
  fetchLiveStoreVersion,
  storeVersionVerdict,
} from "../scripts/store-version-gate.mjs"

test("compareAppVersions orders numerically per component and pads missing components", () => {
  assert.equal(compareAppVersions("1.2.2", "1.2.1"), 1)
  assert.equal(compareAppVersions("1.2.1", "1.2.1"), 0)
  assert.equal(compareAppVersions("1.2.0", "1.2.1"), -1)
  assert.equal(compareAppVersions("1.10.0", "1.9.9"), 1)
  assert.equal(compareAppVersions("2", "1.99.99"), 1)
  assert.equal(compareAppVersions("1.2", "1.2.0"), 0)
})

test("compareAppVersions rejects anything that is not one to three integers", () => {
  for (const bad of ["1.2.3.4", "1.2.x", "", "v1.2.3", "1.2.3-rc.1"]) {
    assert.throws(() => compareAppVersions(bad, "1.0.0"), /not an App Store version/)
  }
})

test("storeVersionVerdict passes only a version strictly above the live one", () => {
  assert.equal(storeVersionVerdict("1.2.2", "1.2.1").ok, true)
  assert.equal(storeVersionVerdict("1.3.0", "1.2.1").ok, true)
  assert.equal(storeVersionVerdict("1.2.1", "1.2.1").ok, false)
  assert.equal(storeVersionVerdict("1.2.0", "1.2.1").ok, false)
  assert.match(storeVersionVerdict("1.2.1", "1.2.1").message, /Bump `version`/)
})

test("storeVersionVerdict passes when the app has no released version yet", () => {
  assert.equal(storeVersionVerdict("1.0.0", null).ok, true)
})

test("fetchLiveStoreVersion reads the live version from Apple's lookup payload", async () => {
  const fetchImpl = async (url: string) => {
    assert.equal(url, "https://itunes.apple.com/lookup?bundleId=org.civfix.community")
    return { ok: true, status: 200, json: async () => ({ resultCount: 1, results: [{ version: "1.2.1" }] }) }
  }
  assert.equal(await fetchLiveStoreVersion("org.civfix.community", fetchImpl as unknown as typeof fetch), "1.2.1")
})

test("fetchLiveStoreVersion treats an unlisted bundle id as no released version", async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ resultCount: 0, results: [] }) })
  assert.equal(await fetchLiveStoreVersion("org.example.new", fetchImpl as unknown as typeof fetch), null)
})

test("fetchLiveStoreVersion reports a transport or HTTP failure as the lookup being unavailable", async () => {
  const failing = async () => ({ ok: false, status: 503, json: async () => ({}) })
  await assert.rejects(
    fetchLiveStoreVersion("org.civfix.community", failing as unknown as typeof fetch),
    (error: unknown) => error instanceof StoreLookupUnavailable && /HTTP 503/.test((error as Error).message),
  )
  const offline = async () => {
    throw new Error("getaddrinfo ENOTFOUND itunes.apple.com")
  }
  await assert.rejects(
    fetchLiveStoreVersion("org.civfix.community", offline as unknown as typeof fetch),
    (error: unknown) => error instanceof StoreLookupUnavailable && /ENOTFOUND/.test((error as Error).message),
  )
})

test("fetchLiveStoreVersion fails on a malformed payload rather than treating it as unavailable", async () => {
  const malformed = async () => ({ ok: true, status: 200, json: async () => ({ resultCount: 1, results: [{}] }) })
  await assert.rejects(
    fetchLiveStoreVersion("org.civfix.community", malformed as unknown as typeof fetch),
    (error: unknown) => !(error instanceof StoreLookupUnavailable) && /without a version/.test((error as Error).message),
  )
})

test("fetchLiveStoreVersion bounds the request with a timeout signal", async () => {
  let signal: AbortSignal | undefined
  const fetchImpl = async (_url: string, init: { signal?: AbortSignal }) => {
    signal = init.signal
    return { ok: true, status: 200, json: async () => ({ resultCount: 0, results: [] }) }
  }
  await fetchLiveStoreVersion("org.civfix.community", fetchImpl as unknown as typeof fetch)
  assert.ok(signal instanceof AbortSignal)
})
