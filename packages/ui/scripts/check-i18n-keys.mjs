#!/usr/bin/env node
/**
 * Key-completeness check: every `es`/`de`/`ko` catalog must have the SAME key set as the `en` source, AND
 * every `t(...)` call site under `src/` must reference a key `en` actually has.
 *
 * `en/<ns>.json` is the source of truth; the other three locales are MT-generated from it and must stay
 * key-complete. This script walks every namespace, deep-diffs each non-en locale's key set against en,
 * and exits NON-ZERO listing any missing (or extra) keys. It is wired as the `i18n:check` package script
 * and is meant to gate CI / the build.
 *
 * Notes on the en<->es/de/ko diff:
 *   - Deep keys: nested objects are compared by their dotted key paths (e.g. `timeline.forwarded`).
 *   - Arrays (e.g. `common-datetime.weekdays`) are treated as LEAF values — the key must exist in the
 *     other locale, but element-by-element content is not compared (length/content is a translator
 *     concern, not a key-completeness one).
 *   - CLDR plurals: Korean has no `_one` form, so a key present only as `<key>_one` in en is NOT required
 *     in `ko` (the `_other` form is). `_one` IS required in es/de (which have a one/other distinction).
 *
 * SOURCE-KEY CHECK (below): the diff above can only ever compare es/de/ko AGAINST en — a key missing from
 * `en` itself (the fallback language) is invisible to it by construction, and i18next's fallback then
 * renders the raw key string in EVERY locale, not just the ones that "failed" a diff. That is exactly what
 * happened for `gate.camera.open_settings` in the mobile app: it was absent from all four catalogs, so the
 * diff above stayed green while the button read `gate.camera.open_settings` for every user. This section
 * closes that gap from the other direction: it greps every literal `t("...")` / `t('...')` / `t(\`...\`)`
 * call under `src/` and confirms the key actually resolves against `en`.
 *
 *   - NO PARSER. This is a plain regex over file text (after stripping comments, so illustrative
 *     `t('example')` calls in docblocks don't get scanned as real call sites). `useT(ns)` binds `t` to a
 *     namespace per call SITE, and resolving that accurately would mean actually parsing the file, which
 *     this script deliberately does not do.
 *   - A `ns:key` call (i18next's cross-namespace form, e.g. `t("common:cancel")`) is checked against that
 *     SPECIFIC namespace's en catalog, because the namespace is right there in the string.
 *   - A bare `t("key")` call is checked against the UNION of every namespace's en keys instead, since this
 *     script does not track which `useT(ns)` a given `t` came from. That still catches a key missing
 *     EVERYWHERE (this review's finding, and the only class of bug this section promises to catch); it can
 *     miss a key that exists in the WRONG namespace's catalog — a narrower, separate bug this script does
 *     not claim to catch.
 *   - CLDR plurals again: a call site normally reads the BASE key (`t("subscribers", { count })`) while
 *     only `<key>_one` / `<key>_other` are real leaves, so a bare key also counts as found if either
 *     suffixed form exists.
 *   - DYNAMIC keys (`t(\`enums:status.${x}\`)`) cannot be resolved statically. These are SKIPPED, not
 *     flagged and not suppressed via an allowlist — the regex only accepts a template literal that
 *     contains no `${`, so an interpolated one simply never becomes a candidate in the first place.
 *   - RENAMED destructures (`const { t: tFoo } = useT(ns)`) are NOT tracked — only calls to the literal
 *     identifier `t(` are scanned. Closing that would mean parsing the destructuring pattern per file,
 *     which is the parser this check deliberately stays away from; renamed call sites are a known gap.
 *
 * EMPTY-VALUE CHECK: the i18next config sets `returnEmptyString: true`, so an empty value renders as
 * nothing instead of falling back to English. That is right for a sentence fragment a locale's word order
 * leaves empty, and wrong for anything else (an unauthored MT stub would silently blank the UI). Every
 * empty string in any catalog therefore fails unless its `<lng>/<ns>:<key>` is in INTENTIONAL_EMPTY.
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

/** Collect the dotted key paths of a catalog object. Arrays are leaves (the path, not the elements). */
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

// Computed once and reused by the source-key check below, so it does not re-read/re-walk every catalog.
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

    // Keys en has that this locale lacks. Korean is exempt from `_one` plural forms (CLDR: ko has only
    // `_other`), so a missing `<key>_one` in ko is allowed iff the `<key>_other` form is present.
    const missing = [...enKeys].filter((k) => {
      if (targetKeys.has(k)) return false
      if (lng === "ko" && k.endsWith("_one")) {
        const other = k.slice(0, -"_one".length) + "_other"
        if (targetKeys.has(other) || enKeys.has(other)) return false
      }
      return true
    })
    // Keys this locale has that en does not (stale / typo'd keys).
    const extra = [...targetKeys].filter((k) => !enKeys.has(k))

    if (missing.length || extra.length) {
      failures++
      if (missing.length) console.error(`MISSING KEYS in ${lng}/${ns}.json:\n  ${missing.join("\n  ")}`)
      if (extra.length) console.error(`EXTRA KEYS in ${lng}/${ns}.json (not in en):\n  ${extra.join("\n  ")}`)
    }
  }
}

/** Dotted paths of every empty-string leaf, including empty array elements (`path[i]`). */
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

// ---- SOURCE-KEY CHECK: every t(...) call site under src/ must resolve against en (see module doc). ----

/** Every `.ts`/`.tsx` file under `dir`, skipping test files/dirs (source-grep guards there quote example
 * keys as plain strings, not real call sites, and would otherwise show up as false positives/negatives). */
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

/** Strip block + line comments so illustrative docblock call sites are never scanned as real ones. */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")
}

/** Is `key` (or its CLDR `<key>_one` / `<key>_other` plural form) present in `keySet`? */
function keyExists(keySet, key) {
  return keySet.has(key) || keySet.has(`${key}_one`) || keySet.has(`${key}_other`)
}

// Matches `t("...")` / `t('...')` / `t(`...`)` - the literal `t` identifier only (see module doc: renamed
// destructures like `tFoo` are a known, accepted gap). Captures whichever quote style matched.
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
    // Dynamic template key (contains `${`) - unresolvable statically, skip outright (not a suppression:
    // it never becomes a candidate key at all).
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
