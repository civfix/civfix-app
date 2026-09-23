#!/usr/bin/env node
import { realpathSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const LOOKUP_URL = "https://itunes.apple.com/lookup"
const LOOKUP_TIMEOUT_MS = 10_000

export class StoreLookupUnavailable extends Error {}

export function compareAppVersions(a, b) {
  const parse = (version) => {
    const parts = String(version).split(".")
    if (parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) {
      throw new Error(`'${version}' is not an App Store version (one to three dot-separated integers)`)
    }
    return [0, 1, 2].map((index) => Number(parts[index] ?? 0))
  }
  const left = parse(a)
  const right = parse(b)
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] < right[index] ? -1 : 1
  }
  return 0
}

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

export async function fetchLiveStoreVersion(bundleId, fetchImpl = fetch) {
  const url = `${LOOKUP_URL}?bundleId=${encodeURIComponent(bundleId)}`
  let response
  try {
    response = await fetchImpl(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    })
  } catch (error) {
    throw new StoreLookupUnavailable(`App Store lookup for ${bundleId} failed: ${error.message}`)
  }
  if (!response.ok) {
    throw new StoreLookupUnavailable(`App Store lookup for ${bundleId} answered HTTP ${response.status}`)
  }
  const body = await response.json()
  if (!Array.isArray(body.results)) {
    throw new Error(`App Store lookup for ${bundleId} returned no results array`)
  }
  if (body.results.length === 0) return null
  const version = body.results[0].version
  if (typeof version !== "string" || version.length === 0) {
    throw new Error(`App Store lookup for ${bundleId} returned a result without a version`)
  }
  return version
}

async function main() {
  const require = createRequire(import.meta.url)
  const appConfig = require("../app.config.js")({ config: {} })
  let liveVersion
  try {
    liveVersion = await fetchLiveStoreVersion(appConfig.ios.bundleIdentifier)
  } catch (error) {
    if (error instanceof StoreLookupUnavailable) {
      console.warn(`WARNING: ${error.message}; skipping the live-version check, the upload will decide.`)
      return
    }
    throw error
  }
  const verdict = storeVersionVerdict(appConfig.version, liveVersion)
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
    console.error(`Refusing to build: ${error.message}`)
    process.exit(1)
  }
}
