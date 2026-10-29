#!/usr/bin/env node
import { realpathSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { loadAppConfig } from "./app-config.mjs"

const LOOKUP_URL = "https://itunes.apple.com/lookup"
const LOOKUP_TIMEOUT_MS = 10_000

export class StoreLookupUnavailable extends Error {}

/**
 * @param {string} a
 * @param {string} b
 */
export function compareAppVersions(a, b) {
  /**
   * @param {string} version
   * @returns {[major: number, minor: number, patch: number]}
   */
  const parse = (version) => {
    const parts = String(version).split(".")
    if (parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) {
      throw new Error(`'${version}' is not an App Store version (one to three dot-separated integers)`)
    }
    return [Number(parts[0] ?? 0), Number(parts[1] ?? 0), Number(parts[2] ?? 0)]
  }
  const left = parse(a)
  const right = parse(b)
  return Math.sign(left[0] - right[0] || left[1] - right[1] || left[2] - right[2])
}

/**
 * @param {string} localVersion
 * @param {string | null} liveVersion
 */
export function storeVersionVerdict(localVersion, liveVersion) {
  if (liveVersion === null) {
    return { ok: true, message: `version ${localVersion}: no released App Store version to clear` }
  }
  if (compareAppVersions(localVersion, liveVersion) > 0) {
    return { ok: true, message: `version ${localVersion} is above the live App Store version ${liveVersion}` }
  }
  return {
    ok: false,
    message:
      `version ${localVersion} is not above the live App Store version ${liveVersion}; App Store Connect ` +
      `rejects every upload of a version it has already approved. Bump \`version\` in ` +
      `apps/community-mobile/app.config.js and package.json (npm version patch --no-git-tag-version ` +
      `from the app directory bumps package.json), merge, and build again.`,
  }
}

/**
 * @param {string} bundleId
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<string | null>}
 */
export async function fetchLiveStoreVersion(bundleId, fetchImpl = fetch) {
  const url = `${LOOKUP_URL}?bundleId=${encodeURIComponent(bundleId)}`
  let response
  try {
    response = await fetchImpl(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new StoreLookupUnavailable(`App Store lookup for ${bundleId} failed: ${reason}`)
  }
  if (!response.ok) {
    throw new StoreLookupUnavailable(`App Store lookup for ${bundleId} answered HTTP ${response.status}`)
  }
  const body = /** @type {unknown} */ (await response.json())
  const results = typeof body === "object" && body !== null && "results" in body ? body.results : undefined
  if (!Array.isArray(results)) {
    throw new Error(`App Store lookup for ${bundleId} returned no results array`)
  }
  if (results.length === 0) return null
  const first = /** @type {unknown} */ (results[0])
  const version = typeof first === "object" && first !== null && "version" in first ? first.version : undefined
  if (typeof version !== "string" || version.length === 0) {
    throw new Error(`App Store lookup for ${bundleId} returned a result without a version`)
  }
  return version
}

async function main() {
  const appConfig = await loadAppConfig()
  const bundleId = appConfig.ios?.bundleIdentifier
  const localVersion = appConfig.version
  if (!bundleId || !localVersion) throw new Error("app.config.js sets no ios.bundleIdentifier or version")
  let liveVersion
  try {
    liveVersion = await fetchLiveStoreVersion(bundleId)
  } catch (error) {
    if (error instanceof StoreLookupUnavailable) {
      console.warn(`WARNING: ${error.message}; skipping the live-version check, the upload will decide.`)
      return
    }
    throw error
  }
  const verdict = storeVersionVerdict(localVersion, liveVersion)
  if (!verdict.ok) {
    console.error(`Refusing to build: ${verdict.message}`)
    process.exit(1)
  }
  console.log(verdict.message)
}

function isMainModule() {
  try {
    return realpathSync(process.argv[1] ?? "") === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
}

if (isMainModule()) {
  try {
    await main()
  } catch (error) {
    console.error(`Refusing to build: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}
