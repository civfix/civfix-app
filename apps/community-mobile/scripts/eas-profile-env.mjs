#!/usr/bin/env node
// Print an eas.json build profile's environment as KEY=value lines (extends resolved, the "//" note
// keys dropped). eas.json stays the one place the EXPO_PUBLIC_* values live even for builds that never
// touch EAS, so the Android gradle build and the iOS EAS build of the same profile bake the same
// configuration.
//
//   node scripts/eas-profile-env.mjs <profile>
import { readFileSync, realpathSync } from "node:fs"
import { fileURLToPath } from "node:url"

const ENV_KEY = /^[A-Z_][A-Z0-9_]*$/

/**
 * @typedef {{ extends?: string, env?: Record<string, string> }} BuildProfile
 * @typedef {{ build?: Record<string, BuildProfile | undefined> }} EasJson
 */

/**
 * @param {EasJson} eas
 * @param {string} name
 * @param {string[]} [seen]
 * @returns {BuildProfile}
 */
export function resolveProfile(eas, name, seen = []) {
  const profile = eas.build?.[name]
  if (!profile) throw new Error(`eas.json has no build profile '${name}'`)
  if (seen.includes(name)) throw new Error(`eas.json profile '${name}' extends itself`)
  /** @type {BuildProfile} */
  const base = profile.extends ? resolveProfile(eas, profile.extends, [...seen, name]) : {}
  return { ...base, ...profile, env: { ...base.env, ...profile.env } }
}

/**
 * @param {EasJson} eas
 * @param {string} name
 */
export function profileEnv(eas, name) {
  const profile = resolveProfile(eas, name)
  const env = Object.fromEntries(Object.entries(profile.env ?? {}).filter(([key]) => ENV_KEY.test(key)))
  for (const [key, value] of Object.entries(env)) {
    if (/[\r\n]/.test(String(value))) throw new Error(`eas.json profile '${name}' ${key} spans lines`)
  }
  return env
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const name = process.argv[2]
  if (!name) {
    console.error("usage: node scripts/eas-profile-env.mjs <profile>")
    process.exit(1)
  }
  const parsed = /** @type {unknown} */ (JSON.parse(readFileSync(new URL("../eas.json", import.meta.url), "utf8")))
  const eas = /** @type {EasJson} */ (parsed)
  for (const [key, value] of Object.entries(profileEnv(eas, name))) console.log(`${key}=${value}`)
}
