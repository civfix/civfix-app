#!/usr/bin/env node
// Google Play publishing for the Android app, straight against the Google Play Developer API — no
// EAS, no fastlane, no dependencies — so the free GitHub runners and a laptop do exactly the same thing.
//
//   node scripts/play-publish.mjs next-version-code
//   node scripts/play-publish.mjs upload <app.aab> --track internal|production [--name <release name>]
//
// next-version-code prints one above the highest version code Play has ever seen for the app (every
// uploaded bundle and apk, plus every track release), never below android.versionCode in
// app.config.js. Play refuses a version code it has seen before, even one never released, so Play
// itself is the counter; nothing has to be committed per build.
//
// upload sends the bundle and releases it on one of two tracks, with the status fixed per track so no
// caller can roll production out by accident:
//   internal     status completed — internal testers get it at once (no review)
//   production   status draft     — nothing reaches users until someone opens Play Console and sends
//                                   the release for review / starts the rollout
//
// Authenticates as a Google Cloud service account that Play Console has granted release permissions
// for this app. PLAY_SERVICE_ACCOUNT_JSON holds the whole downloaded JSON key (a GitHub Actions secret
// in CI, exported by hand on a laptop); it is never logged.
import { createSign } from "node:crypto"
import { realpathSync } from "node:fs"
import { readFile, stat } from "node:fs/promises"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications"
const UPLOAD_API = "https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications"
const TOKEN_URL = "https://oauth2.googleapis.com/token"
const SCOPE = "https://www.googleapis.com/auth/androidpublisher"
const REQUEST_TIMEOUT_MS = 60_000
const UPLOAD_TIMEOUT_MS = 15 * 60_000

export const TRACK_STATUS = { internal: "completed", production: "draft" }

export class PlayError extends Error {}

export function parseServiceAccount(json) {
  let key
  try {
    key = JSON.parse(json)
  } catch {
    throw new PlayError("PLAY_SERVICE_ACCOUNT_JSON is not valid JSON; paste the whole downloaded key file")
  }
  if (key.type !== "service_account" || !key.client_email || !key.private_key) {
    throw new PlayError("PLAY_SERVICE_ACCOUNT_JSON is not a service account key (needs client_email and private_key)")
  }
  return key
}

const base64url = (value) => Buffer.from(value).toString("base64url")

export function signAssertion(account, nowSeconds) {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const claims = base64url(
    JSON.stringify({ iss: account.client_email, scope: SCOPE, aud: TOKEN_URL, iat: nowSeconds, exp: nowSeconds + 3600 }),
  )
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(account.private_key, "base64url")
  return `${header}.${claims}.${signature}`
}

export async function accessToken(account, { fetchImpl = fetch, now = Date.now() } = {}) {
  const response = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signAssertion(account, Math.floor(now / 1000)),
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || !body.access_token) {
    throw new PlayError(`Google refused the service account token (HTTP ${response.status}): ${body.error_description ?? body.error ?? "no detail"}`)
  }
  return body.access_token
}

export function playClient({ packageName, token, fetchImpl = fetch }) {
  async function call(method, url, { json, body, headers = {}, timeout = REQUEST_TIMEOUT_MS } = {}) {
    const response = await fetchImpl(url, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(json ? { "content-type": "application/json" } : {}), ...headers },
      body: json ? JSON.stringify(json) : body,
      signal: AbortSignal.timeout(timeout),
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => "")
      const message = (() => {
        try {
          return JSON.parse(detail).error.message
        } catch {
          return detail.slice(0, 300)
        }
      })()
      throw new PlayError(`${method} ${url.replace(/\?.*/, "")} failed (HTTP ${response.status}): ${message}`)
    }
    return response
  }
  const app = `${API}/${encodeURIComponent(packageName)}`
  const edit = (id) => `${app}/edits/${encodeURIComponent(id)}`
  return {
    async insertEdit() {
      return (await (await call("POST", `${app}/edits`, { json: {} })).json()).id
    },
    async deleteEdit(id) {
      await call("DELETE", edit(id))
    },
    async list(id, kind) {
      return (await call("GET", `${edit(id)}/${kind}`)).json()
    },
    async uploadBundle(id, bytes) {
      // Resumable: a release bundle is tens of megabytes, beyond what a simple media upload is meant for.
      const session = await call("POST", `${UPLOAD_API}/${encodeURIComponent(packageName)}/edits/${encodeURIComponent(id)}/bundles?uploadType=resumable`, {
        json: {},
        headers: { "x-upload-content-type": "application/octet-stream", "x-upload-content-length": String(bytes.length) },
      })
      const location = session.headers.get("location")
      if (!location) throw new PlayError("Play opened no resumable upload session (no Location header)")
      const uploaded = await call("PUT", location, {
        body: bytes,
        headers: { "content-type": "application/octet-stream" },
        timeout: UPLOAD_TIMEOUT_MS,
      })
      return uploaded.json()
    },
    async updateTrack(id, track, release) {
      return (await call("PUT", `${edit(id)}/tracks/${encodeURIComponent(track)}`, { json: { track, releases: [release] } })).json()
    },
    async commit(id) {
      return (await call("POST", `${edit(id)}:commit`)).json()
    },
  }
}

export function highestVersionCode({ bundles = [], apks = [], tracks = [] }) {
  const codes = [
    ...bundles.map((bundle) => bundle.versionCode),
    ...apks.map((apk) => apk.versionCode),
    ...tracks.flatMap((track) => (track.releases ?? []).flatMap((release) => release.versionCodes ?? [])),
  ].map(Number)
  return codes.length ? Math.max(...codes) : 0
}

// An abandoned edit expires on its own, so failing to delete one never fails the command.
async function discardEdit(client, id) {
  try {
    await client.deleteEdit(id)
  } catch (error) {
    console.warn(`warning: could not discard Play edit ${id}: ${error.message}`)
  }
}

export async function nextVersionCode(client, floor) {
  const id = await client.insertEdit()
  try {
    const [bundles, apks, tracks] = await Promise.all(["bundles", "apks", "tracks"].map((kind) => client.list(id, kind)))
    return Math.max(highestVersionCode({ bundles: bundles.bundles, apks: apks.apks, tracks: tracks.tracks }) + 1, floor)
  } finally {
    await discardEdit(client, id)
  }
}

export async function publishBundle(client, { bytes, track, name }) {
  const status = TRACK_STATUS[track]
  if (!status) throw new PlayError(`unknown track '${track}'; expected one of ${Object.keys(TRACK_STATUS).join(", ")}`)
  const id = await client.insertEdit()
  try {
    const bundle = await client.uploadBundle(id, bytes)
    const versionCode = String(bundle.versionCode)
    await client.updateTrack(id, track, { ...(name ? { name } : {}), versionCodes: [versionCode], status })
    await client.commit(id)
    return { versionCode, track, status }
  } catch (error) {
    await discardEdit(client, id)
    if (/cannot be sent for review automatically/i.test(error.message)) {
      throw new PlayError(`${error.message}\nPlay is holding earlier changes for a manual send (e.g. after a rejection); send or discard them in Play Console's Publishing overview, then retry.`)
    }
    if (/only releases with status draft/i.test(error.message)) {
      throw new PlayError(
        `${error.message}\nThe app has never been published in Play Console, so Play only accepts drafts until its first release is rolled out by hand.`,
      )
    }
    throw error
  }
}

function usage() {
  console.error("usage: node scripts/play-publish.mjs next-version-code")
  console.error("       node scripts/play-publish.mjs upload <app.aab> --track internal|production [--name <release name>]")
  process.exit(1)
}

async function main(argv) {
  const [command, ...rest] = argv
  if (command !== "next-version-code" && command !== "upload") usage()
  const require = createRequire(import.meta.url)
  const { android } = require("../app.config.js")({ config: {} })
  const secret = process.env.PLAY_SERVICE_ACCOUNT_JSON
  if (!secret) throw new PlayError("PLAY_SERVICE_ACCOUNT_JSON is not set (the Play Console service account's JSON key)")
  const account = parseServiceAccount(secret)
  const client = playClient({ packageName: android.package, token: await accessToken(account) })

  if (command === "next-version-code") {
    console.log(await nextVersionCode(client, android.versionCode))
    return
  }

  const [aab, ...flags] = rest
  let track
  let name
  for (let i = 0; i < flags.length; i += 2) {
    if (flags[i] === "--track") track = flags[i + 1]
    else if (flags[i] === "--name") name = flags[i + 1]
    else usage()
  }
  if (!aab || !track) usage()
  if (!(await stat(aab)).isFile()) throw new PlayError(`${aab} is not a file`)
  const result = await publishBundle(client, { bytes: await readFile(aab), track, name })
  console.log(`Uploaded ${android.package} version code ${result.versionCode} to the ${result.track} track as ${result.status}.`)
  if (result.status === "draft") console.log("Nothing is live yet: open Play Console, review the draft release and send it for review.")
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof PlayError ? error.message : error.stack)
    process.exit(1)
  })
}
