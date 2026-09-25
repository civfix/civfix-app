import assert from "node:assert/strict"
import { createVerify, generateKeyPairSync } from "node:crypto"
import { test } from "node:test"

import {
  PlayError,
  TRACK_STATUS,
  highestVersionCode,
  nextVersionCode,
  parseServiceAccount,
  playClient,
  publishBundle,
  signAssertion,
} from "../scripts/play-publish.mjs"

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
const account = {
  type: "service_account",
  client_email: "release@civfix.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
}

type Call = { method: string; url: string; headers: Record<string, string>; body: unknown }

type FakeResponse = { status?: number; json?: unknown; headers?: Record<string, string> }

function fakeFetch(responses: FakeResponse[]) {
  const calls: Call[] = []
  const fetchImpl = async (url: string, init: { method: string; headers: Record<string, string>; body: unknown }) => {
    calls.push({ method: init.method, url, headers: init.headers, body: init.body })
    const next = responses.shift() ?? {}
    const status = next.status ?? 200
    return {
      ok: status < 400,
      status,
      headers: new Headers(next.headers ?? {}),
      json: async () => next.json ?? {},
      text: async () => JSON.stringify(next.json ?? {}),
    }
  }
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch }
}

function fakeClient(overrides: Record<string, unknown> = {}) {
  const log: string[] = []
  const client = {
    insertEdit: async () => (log.push("insert"), "edit-1"),
    deleteEdit: async () => void log.push("delete"),
    list: async (_id: string, kind: string) => {
      log.push(`list ${kind}`)
      return {}
    },
    uploadBundle: async () => (log.push("upload"), { versionCode: 12 }),
    updateTrack: async (_id: string, track: string, release: unknown) => {
      log.push(`track ${track} ${JSON.stringify(release)}`)
      return {}
    },
    commit: async () => (log.push("commit"), {}),
    ...overrides,
  }
  return { client, log }
}

test("parseServiceAccount accepts a service account key and rejects anything else", () => {
  assert.equal(parseServiceAccount(JSON.stringify(account)).client_email, account.client_email)
  assert.throws(() => parseServiceAccount("{not json"), PlayError)
  assert.throws(() => parseServiceAccount(JSON.stringify({ type: "authorized_user" })), /not a service account key/)
})

test("signAssertion produces an RS256 JWT for the androidpublisher scope, signed by the key", () => {
  const jwt = signAssertion(account, 1_000_000)
  const [header, claims, signature] = jwt.split(".")
  assert.deepEqual(JSON.parse(Buffer.from(header, "base64url").toString()), { alg: "RS256", typ: "JWT" })
  assert.deepEqual(JSON.parse(Buffer.from(claims, "base64url").toString()), {
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token",
    iat: 1_000_000,
    exp: 1_003_600,
  })
  const verified = createVerify("RSA-SHA256").update(`${header}.${claims}`).verify(publicKey, signature, "base64url")
  assert.equal(verified, true)
})

test("highestVersionCode spans bundles, apks and every track release, whose codes arrive as strings", () => {
  assert.equal(highestVersionCode({}), 0)
  assert.equal(
    highestVersionCode({
      bundles: [{ versionCode: 7 }],
      apks: [{ versionCode: 9 }],
      tracks: [{ track: "internal", releases: [{ versionCodes: ["11"] }] }, { track: "production" }],
    }),
    11,
  )
})

test("nextVersionCode is one past everything Play has seen, never below the app.config floor, and discards its edit", async () => {
  const { client, log } = fakeClient({
    list: async (_id: string, kind: string) =>
      kind === "bundles" ? { bundles: [{ versionCode: 8 }] } : kind === "tracks" ? { tracks: [] } : {},
  })
  assert.equal(await nextVersionCode(client, 6), 9)
  assert.equal(await nextVersionCode(client, 20), 20)
  assert.equal(log.filter((entry) => entry === "delete").length, 2)
})

test("nextVersionCode still discards the edit when a listing fails", async () => {
  const { client, log } = fakeClient({
    list: async () => {
      throw new PlayError("boom")
    },
  })
  await assert.rejects(nextVersionCode(client, 6), /boom/)
  assert.deepEqual(log, ["insert", "delete"])
})

test("each track has a fixed release status: internal rolls out, production is only ever a draft", async () => {
  assert.deepEqual(TRACK_STATUS, { internal: "completed", production: "draft" })
  for (const [track, status] of Object.entries(TRACK_STATUS)) {
    const { client, log } = fakeClient()
    const result = await publishBundle(client, { bytes: Buffer.from("aab"), track, name: "1.3.1" })
    assert.deepEqual(result, { versionCode: "12", track, status })
    assert.deepEqual(log, [
      "insert",
      "upload",
      `track ${track} ${JSON.stringify({ name: "1.3.1", versionCodes: ["12"], status })}`,
      "commit",
    ])
  }
})

test("publishBundle refuses an unknown track before touching Play", async () => {
  const { client, log } = fakeClient()
  await assert.rejects(publishBundle(client, { bytes: Buffer.from("aab"), track: "beta" }), /unknown track 'beta'/)
  assert.deepEqual(log, [])
})

test("a failed publish discards the edit and explains the never-published-app rule", async () => {
  const { client, log } = fakeClient({
    updateTrack: async () => {
      throw new PlayError("PUT tracks failed (HTTP 400): Only releases with status draft may be created on draft app.")
    },
  })
  await assert.rejects(
    publishBundle(client, { bytes: Buffer.from("aab"), track: "internal" }),
    /never been published in Play Console/,
  )
  assert.equal(log.at(-1), "delete")
  assert.equal(log.includes("commit"), false)
})

test("uploadBundle opens a resumable session and PUTs the bytes to the session URL", async () => {
  const { calls, fetchImpl } = fakeFetch([
    { headers: { location: "https://upload.example/session/1" } },
    { json: { versionCode: 12 } },
  ])
  const client = playClient({ packageName: "org.civfix.community", token: "t0k", fetchImpl })
  const bytes = Buffer.from("bundle-bytes")
  assert.deepEqual(await client.uploadBundle("edit-1", bytes), { versionCode: 12 })
  assert.equal(calls[0].method, "POST")
  assert.equal(
    calls[0].url,
    "https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/org.civfix.community/edits/edit-1/bundles?uploadType=resumable",
  )
  assert.equal(calls[0].headers["x-upload-content-length"], String(bytes.length))
  assert.equal(calls[0].headers.authorization, "Bearer t0k")
  assert.deepEqual([calls[1].method, calls[1].url, calls[1].body], ["PUT", "https://upload.example/session/1", bytes])
})

test("an API error surfaces Google's message without the query string", async () => {
  const { fetchImpl } = fakeFetch([{ status: 403, json: { error: { message: "The caller does not have permission" } } }])
  const client = playClient({ packageName: "org.civfix.community", token: "t0k", fetchImpl })
  await assert.rejects(client.insertEdit(), /POST .*\/edits failed \(HTTP 403\): The caller does not have permission/)
})
