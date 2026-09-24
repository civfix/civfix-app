#!/usr/bin/env node
/**
 * The `i18n:check` gate.
 *
 * Catalog diff: every es/de/ko catalog must have en's key set, since en is the source the others are
 * machine-translated from. Arrays are leaves (element content is a translator concern). Korean has no
 * `_one` plural form, so ko only needs `<key>_other`.
 *
 * Source-key check: the diff cannot see a key missing from en itself, and i18next then renders the raw key
 * in every locale, so every literal `t(...)` call under `src/` must resolve against en. It is a regex over
 * comment-stripped text, deliberately not a parser:
 *   - a `ns:key` call is checked against that namespace's catalog;
 *   - a bare key is checked against the union of all namespaces, because the script cannot tell which
 *     `useT(ns)` bound `t`; a key present only in the wrong namespace is therefore not caught;
 *   - a base key also counts as found when its `_one` or `_other` plural form exists;
 *   - an interpolated template key never becomes a candidate;
 *   - renamed destructures (`const { t: tFoo } = useT(ns)`) are not scanned, a known gap.
 *
 * Empty-value check: `returnEmptyString: true` renders an empty value as nothing instead of English, which
 * is right only for a word-order fragment, so any empty value fails unless it is in INTENTIONAL_EMPTY.
 */
import { readdirSync, readFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const localesDir = process.env.CIVFIX_I18N_LOCALES_DIR ?? join(__dirname, "..", "src", "i18n", "locales")
const srcDir = join(__dirname, "..", "src")

const SOURCE = "en"
const TARGETS = ["es", "de", "ko"]

const INTENTIONAL_EMPTY = new Set([
  "ko/account-delete:verify.enterPre",
  "ko/host-ticket:consent.terms_lead",
  "ko/messages-list:signed_out.body_before",
  "ko/onboarding-terms:label.lead",
])

function keyPaths(obj, prefix = "") {
  const out = new Set()
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return out
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      const nested = keyPaths(v, path)
      if (nested.size === 0) out.add(path)
      for (const p of nested) out.add(p)
    } else {
      out.add(path)
    }
  }
  return out
}

function readCatalog(lng, ns) {
  try {
    return JSON.parse(readFileSync(join(localesDir, lng, `${ns}.json`), "utf8"))
  } catch {
    return null
  }
}

const namespaces = readdirSync(join(localesDir, SOURCE))
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""))
  .sort()

let failures = 0

const enKeysByNs = new Map(namespaces.map((ns) => [ns, keyPaths(readCatalog(SOURCE, ns) ?? {})]))

for (const ns of namespaces) {
  const enKeys = enKeysByNs.get(ns)
  for (const lng of TARGETS) {
    const cat = readCatalog(lng, ns)
    if (cat === null) {
      console.error(`MISSING FILE: ${lng}/${ns}.json (en/${ns}.json exists)`)
      failures++
      continue
    }
    const targetKeys = keyPaths(cat)

    // CLDR gives ko only `_other`, so a missing `<key>_one` in ko is allowed when `<key>_other` exists.
    const missing = [...enKeys].filter((k) => {
      if (targetKeys.has(k)) return false
      if (lng === "ko" && k.endsWith("_one")) {
        const other = k.slice(0, -"_one".length) + "_other"
        if (targetKeys.has(other) || enKeys.has(other)) return false
      }
      return true
    })
    const extra = [...targetKeys].filter((k) => !enKeys.has(k))

    if (missing.length || extra.length) {
      failures++
      if (missing.length) console.error(`MISSING KEYS in ${lng}/${ns}.json:\n  ${missing.join("\n  ")}`)
      if (extra.length) console.error(`EXTRA KEYS in ${lng}/${ns}.json (not in en):\n  ${extra.join("\n  ")}`)
    }
  }
}

function emptyValuePaths(obj, prefix = "") {
  const out = []
  if (obj === null || typeof obj !== "object") return out
  for (const [k, v] of Object.entries(obj)) {
    const path = Array.isArray(obj) ? `${prefix}[${k}]` : prefix ? `${prefix}.${k}` : k
    if (v === "") out.push(path)
    else if (v !== null && typeof v === "object") out.push(...emptyValuePaths(v, path))
  }
  return out
}

const emptyFailures = []
for (const lng of [SOURCE, ...TARGETS]) {
  for (const ns of namespaces) {
    for (const path of emptyValuePaths(readCatalog(lng, ns) ?? {})) {
      const id = `${lng}/${ns}:${path}`
      if (!INTENTIONAL_EMPTY.has(id)) emptyFailures.push(id)
    }
  }
}
if (emptyFailures.length) {
  failures += emptyFailures.length
  console.error(
    `EMPTY VALUES (they render blank; author them, or allowlist a deliberate word-order fragment):\n  ${emptyFailures.join("\n  ")}`,
  )
}

// Tests are skipped: source-grep guards quote example keys as plain strings, not real call sites.
function collectSourceFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "__tests__" || entry.name === "node_modules") continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...collectSourceFiles(full))
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

// Illustrative call sites in docblocks must never be scanned as real ones.
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")
}

function keyExists(keySet, key) {
  return keySet.has(key) || keySet.has(`${key}_one`) || keySet.has(`${key}_other`)
}

const T_CALL = /\bt\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`([^`]*)`)/g

const enKeyUnion = new Set([...enKeysByNs.values()].flatMap((s) => [...s]))
const sourceFailures = []

for (const file of collectSourceFiles(srcDir)) {
  const text = stripComments(readFileSync(file, "utf8"))
  const rel = relative(srcDir, file)
  let m
  T_CALL.lastIndex = 0
  while ((m = T_CALL.exec(text))) {
    const raw = m[1] ?? m[2] ?? m[3]
    if (raw === undefined) continue
    if (m[3] !== undefined && raw.includes("${")) continue

    const colon = raw.indexOf(":")
    if (colon > 0) {
      const ns = raw.slice(0, colon)
      const rest = raw.slice(colon + 1)
      const nsKeys = enKeysByNs.get(ns)
      if (!nsKeys) {
        sourceFailures.push(`${rel}: t("${raw}") - namespace "${ns}" has no en/${ns}.json`)
      } else if (!keyExists(nsKeys, rest)) {
        sourceFailures.push(`${rel}: t("${raw}") - "${rest}" missing from en/${ns}.json`)
      }
    } else if (!keyExists(enKeyUnion, raw)) {
      sourceFailures.push(`${rel}: t("${raw}") - not found in any en/*.json namespace`)
    }
  }
}

if (sourceFailures.length) {
  failures += sourceFailures.length
  console.error(
    `\nSOURCE KEYS MISSING FROM en (t(...) call sites whose key en does not have):\n  ${sourceFailures.join("\n  ")}`,
  )
}

if (failures > 0) {
  console.error(`\ni18n key check FAILED: ${failures} catalog(s)/call site(s) out of sync with en.`)
  process.exit(1)
}
console.log(
  `i18n key check OK: ${namespaces.length} namespaces key-complete across ${TARGETS.join(", ")}; no unexpected empty values; source t(...) call sites all resolve against en.`,
)
