#!/usr/bin/env node
/**
 * Resolves every literal translate call in packages/ui and both apps against the en catalogs, per
 * namespace. `packages/ui/scripts/check-i18n-keys.mjs` checks the catalogs themselves and matches bare
 * keys against the union of every namespace, so it cannot see a key that exists only in another
 * namespace, and it never scanned the apps: i18next has no `fallbackNS`, so either mistake renders the
 * raw key.
 *
 * Namespace resolution mirrors packages/ui/src/i18n: `useT(ns)` is `useTranslation(ns)`, `useT()` binds
 * config.ts's defaultNS, `ns:key` names a namespace explicitly, `.` nests, and `getFixedT(null, "ns")`
 * binds one outside React. It is a regex over comment-stripped text, not a parser, so:
 *   - an identifier bound to several namespaces in one file resolves if ANY of them has the key;
 *   - a `t` with no binding in the file (passed in as a prop) falls back to the union of namespaces;
 *   - `${...}` template keys are dynamic and skipped;
 *   - a CLDR plural suffix on the catalog key counts as the base key.
 */
import { readdirSync, readFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const LOCALES_EN = join(ROOT, "packages/ui/src/i18n/locales/en")
const DEFAULT_NS = "common"
const SCANNED = [
  ["packages/ui", ["src"]],
  ["apps/community-web", ["src"]],
  ["apps/community-mobile", ["app", "src"]],
]
const SKIPPED_DIRS = new Set(["__tests__", "__testing__", "node_modules", "locales", "catalogs"])
const PLURAL_SUFFIXES = ["", "_zero", "_one", "_two", "_few", "_many", "_other"]
const MAX_OPTIONS_LOOKAHEAD = 120

const leaves = new Map()
const nodes = new Map()
function collectKeys(ns, obj, prefix) {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      nodes.get(ns).add(path)
      collectKeys(ns, v, path)
    } else {
      leaves.get(ns).add(path)
    }
  }
}
for (const file of readdirSync(LOCALES_EN).filter((f) => f.endsWith(".json"))) {
  const ns = file.replace(/\.json$/, "")
  leaves.set(ns, new Set())
  nodes.set(ns, new Set())
  collectKeys(ns, JSON.parse(readFileSync(join(LOCALES_EN, file), "utf8")), "")
}
const hasLeaf = (ns, key) => PLURAL_SUFFIXES.some((suffix) => leaves.get(ns)?.has(key + suffix))
const namespacesWith = (key) => [...leaves.keys()].filter((ns) => hasLeaf(ns, key))

function sourceFiles(dir) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  return entries.flatMap((entry) => {
    if (SKIPPED_DIRS.has(entry.name)) return []
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")
      ? [full]
      : []
  })
}

// Blanks comments but keeps newlines so reported lines match the file; quoted strings are skipped so a
// "https://" inside one is not taken for a comment.
function stripComments(text) {
  let out = ""
  let i = 0
  while (i < text.length) {
    const c = text[i]
    const n = text[i + 1]
    if (c === "/" && n === "/") {
      while (i < text.length && text[i] !== "\n") i++
    } else if (c === "/" && n === "*") {
      i += 2
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) out += text[i++] === "\n" ? "\n" : ""
      i += 2
    } else if (c === '"' || c === "'" || c === "`") {
      out += text[i++]
      while (i < text.length && text[i] !== c) {
        if (text[i] === "\\") out += text[i++]
        out += text[i++]
      }
      out += text[i++] ?? ""
    } else out += text[i++]
  }
  return out
}

const lineOf = (text, index) => text.slice(0, index).split("\n").length
const STR = `(?:"([^"\\\\]*)"|'([^'\\\\]*)')`
const escapeId = (id) => id.replace(/\$/g, "\\$")

function bindings(text) {
  const bound = new Map()
  const bind = (id, ns) => {
    if (!bound.has(id)) bound.set(id, new Set())
    bound.get(id).add(ns)
  }
  for (const m of text.matchAll(new RegExp(`\\{([^{}]*)\\}\\s*=\\s*useT\\(\\s*(?:${STR})?\\s*\\)`, "g"))) {
    const ns = m[2] ?? m[3] ?? DEFAULT_NS
    for (const part of m[1].split(",")) {
      const renamed = part.trim().match(/^t(?:\s*:\s*([A-Za-z_$][\w$]*))?$/)
      if (renamed) bind(renamed[1] ?? "t", ns)
    }
  }
  for (const m of text.matchAll(new RegExp(`(?:const|let)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*useT\\(\\s*(?:${STR})?\\s*\\)\\.t\\b`, "g")))
    bind(m[1], m[2] ?? m[3] ?? DEFAULT_NS)
  for (const m of text.matchAll(new RegExp(`(?:const|let)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*[^;\\n]*getFixedT\\(\\s*null\\s*,\\s*${STR}\\s*\\)`, "g")))
    bind(m[1], m[2] ?? m[3])
  return bound
}

const failures = []
let checked = 0

for (const [workspace, dirs] of SCANNED) {
  for (const file of dirs.flatMap((dir) => sourceFiles(join(ROOT, workspace, dir)))) {
    const text = stripComments(readFileSync(file, "utf8"))
    const rel = relative(ROOT, file)
    const bound = bindings(text)
    for (const id of new Set(["t", ...bound.keys()])) {
      const call = new RegExp(
        `(?<![\\w$.])${escapeId(id)}\\(\\s*(?:"((?:[^"\\\\]|\\\\.)*)"|'((?:[^'\\\\]|\\\\.)*)'|\`([^\`]*)\`)([^)]{0,${MAX_OPTIONS_LOOKAHEAD}})`,
        "g",
      )
      for (const m of text.matchAll(call)) {
        const raw = m[1] ?? m[2] ?? m[3]
        if (raw === undefined || (m[3] !== undefined && raw.includes("${"))) continue
        checked++
        const where = `${rel}:${lineOf(text, m.index)} ${id}("${raw}")`
        const options = m[4] ?? ""
        const colon = raw.indexOf(":")
        const prefix = colon > 0 ? raw.slice(0, colon) : ""
        let key = raw
        let scope
        if (prefix && leaves.has(prefix)) {
          scope = [prefix]
          key = raw.slice(colon + 1)
        } else if (prefix && /^[a-z][a-z-]*$/.test(prefix)) {
          failures.push(`${where}: namespace "${prefix}" has no en catalog`)
          continue
        } else {
          const nsOption = options.match(new RegExp(`\\bns\\s*:\\s*${STR}`))
          if (nsOption) scope = [nsOption[1] ?? nsOption[2]]
          else if (bound.has(id)) scope = [...bound.get(id)]
        }
        const candidates = scope ?? [...leaves.keys()]
        if (candidates.some((ns) => hasLeaf(ns, key))) continue
        if (candidates.some((ns) => nodes.get(ns)?.has(key))) {
          if (!/returnObjects/.test(options)) failures.push(`${where}: names an object, not a string (needs returnObjects)`)
          continue
        }
        const elsewhere = namespacesWith(key)
        const label = scope ? `namespace ${scope.join("|")}` : "any namespace"
        failures.push(
          `${where}: not in ${label}${elsewhere.length ? `; it exists in ${elsewhere.join(", ")}` : ", nor any en catalog"}`,
        )
      }
    }
  }
}

if (failures.length) {
  console.error(`i18n call sites that render a raw key (${failures.length}):\n  ${failures.join("\n  ")}`)
  process.exit(1)
}
console.log(`i18n call-site check OK: ${checked} literal keys resolve against en in their namespace.`)
