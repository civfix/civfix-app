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
import { fileURLToPath } from "node:url"

import { loadAppConfig } from "./app-config.mjs"

const API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications"
const UPLOAD_API = "https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications"
const TOKEN_URL = "https://oauth2.googleapis.com/token"
const SCOPE = "https://www.googleapis.com/auth/androidpublisher"
const REQUEST_TIMEOUT_MS = 60_000
const UPLOAD_TIMEOUT_MS = 15 * 60_000

export const TRACK_STATUS = { internal: "completed", production: "draft" }

export class PlayError extends Error {}

/**
 * @typedef {{ client_email: string, private_key: string }} ServiceAccount
 * @typedef {{
 *   bundles?: { versionCode: number }[] | undefined,
 *   apks?: { versionCode: number }[] | undefined,
 *   tracks?: { track: string, releases?: { versionCodes?: string[] }[] }[] | undefined,
 * }} PlayListing
 * @typedef {{ name?: string, versionCodes: string[], status: string }} PlayRelease
 * @typedef {{
 *   insertEdit(): Promise<string>,
 *   deleteEdit(id: string): Promise<void>,
 *   list(id: string, kind: string): Promise<PlayListing>,
 *   uploadBundle(id: string, bytes: Buffer): Promise<{ versionCode?: number }>,
 *   updateTrack(id: string, track: string, release: PlayRelease): Promise<unknown>,
 *   commit(id: string): Promise<unknown>,
 * }} PlayEdits
 */

/**
 * @param {unknown} value
 * @param {string} name
 * @returns {unknown}
 */
const field = (value, name) => (typeof value === "object" && value !== null ? Reflect.get(value, name) : undefined)

/**
 * @param {string} json
 * @returns {ServiceAccount}
 */
export function parseServiceAccount(json) {
  /** @type {unknown} */
  let key
  try {
    key = JSON.parse(json)
  } catch {
    throw new PlayError("PLAY_SERVICE_ACCOUNT_JSON is not valid JSON; paste the whole downloaded key file")
  }
  const clientEmail = field(key, "client_email")
  const privateKey = field(key, "private_key")
  if (typeof key !== "object" || key === null || field(key, "type") !== "service_account" || typeof clientEmail !== "string" || !clientEmail || typeof privateKey !== "string" || !privateKey) {
    throw new PlayError("PLAY_SERVICE_ACCOUNT_JSON is not a service account key (needs client_email and private_key)")
  }
  return { ...key, client_email: clientEmail, private_key: privateKey }
}

/** @param {string} value */
const base64url = (value) => Buffer.from(value).toString("base64url")

/**
 * @param {ServiceAccount} account
 * @param {number} nowSeconds
 */
export function signAssertion(account, nowSeconds) {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const claims = base64url(
    JSON.stringify({ iss: account.client_email, scope: SCOPE, aud: TOKEN_URL, iat: nowSeconds, exp: nowSeconds + 3600 }),
  )
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(account.private_key, "base64url")
  return `${header}.${claims}.${signature}`
}

/**
 * @param {ServiceAccount} account
 * @param {{ fetchImpl?: typeof fetch, now?: number }} [options]
 * @returns {Promise<string>}
 */
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
  const token = field(body, "access_token")
  if (!response.ok || typeof token !== "string" || !token) {
    const detail = field(body, "error_description") ?? field(body, "error") ?? "no detail"
    throw new PlayError(`Google refused the service account token (HTTP ${response.status}): ${typeof detail === "string" ? detail : JSON.stringify(detail)}`)
  }
  return token
}

/**
 * Google's JSON error message when the body carries one, else the start of the raw body.
 * @param {string} detail
 */
function googleErrorMessage(detail) {
  /** @type {unknown} */
  let parsed
  try {
    parsed = JSON.parse(detail)
  } catch {
    return detail.slice(0, 300)
  }
  const message = field(field(parsed, "error"), "message")
  return typeof message === "string" ? message : detail.slice(0, 300)
}

/**
 * @param {{ packageName: string, token: string, fetchImpl?: typeof fetch }} options
 * @returns {PlayEdits}
 */
export function playClient({ packageName, token, fetchImpl = fetch }) {
  /**
   * @param {string} method
   * @param {string} url
   * @param {{ json?: unknown, body?: RequestInit["body"], headers?: Record<string, string>, timeout?: number }} [options]
   */
  async function call(method, url, { json, body, headers = {}, timeout = REQUEST_TIMEOUT_MS } = {}) {
    const response = await fetchImpl(url, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(json ? { "content-type": "application/json" } : {}), ...headers },
      body: json ? JSON.stringify(json) : (body ?? null),
      signal: AbortSignal.timeout(timeout),
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => "")
      const message = googleErrorMessage(detail)
      throw new PlayError(`${method} ${url.replace(/\?.*/, "")} failed (HTTP ${response.status}): ${message}`)
    }
    return response
  }
  const app = `${API}/${encodeURIComponent(packageName)}`
  /** @param {string} id */
  const edit = (id) => `${app}/edits/${encodeURIComponent(id)}`
  return {
    async insertEdit() {
      const id = field(await (await call("POST", `${app}/edits`, { json: {} })).json(), "id")
      if (typeof id !== "string") throw new PlayError("Play created an edit without an id")
      return id
    },
    async deleteEdit(id) {
      await call("DELETE", edit(id))
    },
    async list(id, kind) {
      return /** @type {PlayListing} */ (await (await call("GET", `${edit(id)}/${kind}`)).json())
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
      return /** @type {{ versionCode?: number }} */ (await uploaded.json())
    },
    async updateTrack(id, track, release) {
      return (await call("PUT", `${edit(id)}/tracks/${encodeURIComponent(track)}`, { json: { track, releases: [release] } })).json()
    },
    async commit(id) {
      return (await call("POST", `${edit(id)}:commit`)).json()
    },
  }
}

/** @param {PlayListing} listing */
export function highestVersionCode({ bundles = [], apks = [], tracks = [] }) {
  const codes = [
    ...bundles.map((bundle) => bundle.versionCode),
    ...apks.map((apk) => apk.versionCode),
    ...tracks.flatMap((track) => (track.releases ?? []).flatMap((release) => release.versionCodes ?? [])),
  ].map(Number)
  return codes.length ? Math.max(...codes) : 0
}

// An abandoned edit expires on its own, so failing to delete one never fails the command.
/**
 * @param {PlayEdits} client
 * @param {string} id
 */
async function discardEdit(client, id) {
  try {
    await client.deleteEdit(id)
  } catch (error) {
    console.warn(`warning: could not discard Play edit ${id}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * @param {PlayEdits} client
 * @param {number} floor
 */
export async function nextVersionCode(client, floor) {
  const id = await client.insertEdit()
  try {
    const [bundles, apks, tracks] = await Promise.all([
      client.list(id, "bundles"),
      client.list(id, "apks"),
      client.list(id, "tracks"),
    ])
    return Math.max(highestVersionCode({ bundles: bundles.bundles, apks: apks.apks, tracks: tracks.tracks }) + 1, floor)
  } finally {
    await discardEdit(client, id)
  }
}

/**
 * @param {PlayEdits} client
 * @param {{ bytes: Buffer, track: string, name?: string | undefined }} release
 */
export async function publishBundle(client, { bytes, track, name }) {
  const status = Object.hasOwn(TRACK_STATUS, track) ? TRACK_STATUS[/** @type {keyof typeof TRACK_STATUS} */ (track)] : undefined
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
    const message = error instanceof Error ? error.message : String(error)
    if (/cannot be sent for review automatically/i.test(message)) {
      throw new PlayError(`${message}\nPlay is holding earlier changes for a manual send (e.g. after a rejection); send or discard them in Play Console's Publishing overview, then retry.`)
    }
    if (/only releases with status draft/i.test(message)) {
      throw new PlayError(
        `${message}\nThe app has never been published in Play Console, so Play only accepts drafts until its first release is rolled out by hand.`,
      )
    }
    throw error
  }
}

/** @returns {never} */
function usage() {
  console.error("usage: node scripts/play-publish.mjs next-version-code")
  console.error("       node scripts/play-publish.mjs upload <app.aab> --track internal|production [--name <release name>]")
  process.exit(1)
}

/** @param {string[]} argv */
async function main(argv) {
  const [command, ...rest] = argv
  if (command !== "next-version-code" && command !== "upload") usage()
  const { android } = await loadAppConfig()
  const packageName = android?.package
  const versionCodeFloor = android?.versionCode
  if (!packageName || versionCodeFloor === undefined) {
    throw new PlayError("app.config.js sets no android.package or android.versionCode")
  }
  const secret = process.env.PLAY_SERVICE_ACCOUNT_JSON
  if (!secret) throw new PlayError("PLAY_SERVICE_ACCOUNT_JSON is not set (the Play Console service account's JSON key)")
  const account = parseServiceAccount(secret)
  const client = playClient({ packageName, token: await accessToken(account) })

  if (command === "next-version-code") {
    console.log(await nextVersionCode(client, versionCodeFloor))
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
  console.log(`Uploaded ${packageName} version code ${result.versionCode} to the ${result.track} track as ${result.status}.`)
  if (result.status === "draft") console.log("Nothing is live yet: open Play Console, review the draft release and send it for review.")
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((/** @type {unknown} */ error) => {
    console.error(error instanceof PlayError ? error.message : error instanceof Error ? error.stack : error)
    process.exit(1)
  })
}
