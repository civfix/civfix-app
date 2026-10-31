import { createHash } from "node:crypto"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

// The fake-data dev galleries (next.config.mjs pageExtensionsFor). A production export must not ship
// them: they show a fake signed-in shell and pull third-party sample media.
export const DEV_ONLY_ROUTES = ["bodies", "skeleton", "landscape"]

// WhatsApp silently drops a link-preview image above ~300 KB.
export const OG_IMAGE_MAX_BYTES = 300 * 1024

export const REQUIRED_AASA_EXCLUDES = [
  "/legal/*",
  "/service-record/*",
  "/guest*",
  "/claim*",
  "/manage*",
  "/e/*",
  "/unsubscribe*",
]

/** @param {string[]} outEntries */
export function leakedDevRoutes(outEntries) {
  const names = new Set(outEntries)
  return DEV_ONLY_ROUTES.filter((route) => names.has(route) || names.has(`${route}.html`))
}

/**
 * @param {string[]} shellRoutes
 * @param {string} redirects
 */
export function spaFallbackGaps(shellRoutes, redirects) {
  /** @type {Set<string>} */
  const rules = new Set()
  for (const raw of redirects.split("\n")) {
    const line = raw.trim()
    if (line.length === 0 || line.startsWith("#")) continue
    const [from] = line.split(/\s+/)
    if (from === undefined) continue
    const route = /^\/([^/*\s]+)\/\*$/.exec(from)?.[1]
    if (route !== undefined) rules.add(route)
  }
  return shellRoutes.filter((route) => !rules.has(route)).sort()
}

// The association file is parsed JSON, so every level is read as untrusted shape.
/**
 * @param {unknown} value
 * @param {string} key
 * @returns {unknown}
 */
const field = (value, key) =>
  value !== null && typeof value === "object"
    ? /** @type {Record<string, unknown>} */ (value)[key]
    : undefined

/**
 * @param {unknown} value
 * @returns {value is unknown[]}
 */
const isArray = (value) => Array.isArray(value)

/** @param {unknown} entry */
const isCatchAll = (entry) => field(entry, "/") === "/*" && field(entry, "exclude") !== true

/**
 * @param {unknown} entry
 * @param {string} fallback
 */
const componentPath = (entry, fallback) => {
  const path = field(entry, "/")
  return typeof path === "string" ? path : fallback
}

/** @param {unknown} entry */
const isExclude = (entry) => field(entry, "exclude") === true

/**
 * @param {unknown} association
 * @returns {unknown[]}
 */
function detailEntries(association) {
  const details = field(field(association, "applinks"), "details")
  return isArray(details) ? details : []
}

/**
 * @param {unknown} association
 * @returns {{ ok: boolean, reason: string | null, catchAllIndex: number, lateExcludes: string[] }}
 */
export function aasaExcludeOrder(association) {
  const details = detailEntries(association)
  if (details.length === 0) {
    return { ok: false, reason: "no-components", catchAllIndex: -1, lateExcludes: [] }
  }
  for (const [index, detail] of details.entries()) {
    const components = field(detail, "components")
    if (!isArray(components)) {
      return {
        ok: false,
        reason: `no-components (details[${index}])`,
        catchAllIndex: -1,
        lateExcludes: [],
      }
    }
    const catchAllIndex = components.findIndex(isCatchAll)
    if (catchAllIndex === -1) continue
    const lateExcludes = components
      .slice(catchAllIndex + 1)
      .filter(isExclude)
      .map((entry) => componentPath(entry, "?"))
    if (lateExcludes.length > 0) {
      return {
        ok: false,
        reason: `exclude-after-catch-all (details[${index}])`,
        catchAllIndex,
        lateExcludes,
      }
    }
  }
  const anyCatchAll = details.some((detail) => {
    const components = field(detail, "components")
    return isArray(components) && components.some(isCatchAll)
  })
  if (!anyCatchAll) {
    return { ok: false, reason: "no-catch-all", catchAllIndex: -1, lateExcludes: [] }
  }
  return { ok: true, reason: null, catchAllIndex: 0, lateExcludes: [] }
}

/**
 * @param {unknown} association
 * @param {string[]} required
 */
export function missingAasaExcludes(association, required) {
  const details = detailEntries(association)
  if (details.length === 0) return [...required]
  /** @type {Set<string>} */
  const missing = new Set()
  for (const detail of details) {
    const components = field(detail, "components")
    const present = new Set(
      (isArray(components) ? components : [])
        .filter(isExclude)
        .map((entry) => componentPath(entry, "")),
    )
    for (const pattern of required) if (!present.has(pattern)) missing.add(pattern)
  }
  return required.filter((pattern) => missing.has(pattern))
}

/** @param {string} html */
export function canonicalDocumentText(html) {
  const withoutScripts = html
    .replace(/<script(?:[\t\n\f\r /][^>]*)?>[\s\S]*?<\/script(?:[\t\n\f\r /][^>]*)?>/gi, " ")
    .replace(/<style(?:[\t\n\f\r /][^>]*)?>[\s\S]*?<\/style(?:[\t\n\f\r /][^>]*)?>/gi, " ")
  const blockBreaks = withoutScripts.replace(
    /<\/(p|div|section|article|h[1-6]|li|tr|table|ul|ol|dl|dd|dt|blockquote|header|footer)\s*>/gi,
    "\n",
  )
  const text = blockBreaks.replace(/<[^>]+>/g, " ")
  return decodeEntities(text)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n")
}

/** @type {Record<string, string | undefined>} */
const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  mdash: "\u2014",
  ndash: "–",
  hellip: "…",
  zwnj: "",
  copy: "©",
  middot: "·",
  times: "×",
  ge: "≥",
  le: "≤",
}

/** @param {string} value */
function decodeEntities(value) {
  return value.replace(
    /&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g,
    (/** @type {string} */ match, /** @type {string} */ body) => {
      if (body.startsWith("#x") || body.startsWith("#X")) {
        return String.fromCodePoint(Number.parseInt(body.slice(2), 16))
      }
      if (body.startsWith("#")) return String.fromCodePoint(Number.parseInt(body.slice(1), 10))
      const name = body.toLowerCase()
      return (Object.hasOwn(NAMED_ENTITIES, name) ? NAMED_ENTITIES[name] : undefined) ?? match
    },
  )
}

/** @param {string} html */
export function extractLegalArticle(html) {
  const open = /<article\b[^>]*class="[^"]*legal-prose[^"]*"[^>]*>/i.exec(html)
  if (open === null) return null
  const start = open.index + open[0].length
  let depth = 1
  let cursor = start
  const tag = /<(\/?)article\b[^>]*>/gi
  tag.lastIndex = start
  let match = tag.exec(html)
  while (match !== null) {
    depth += match[1] === "/" ? -1 : 1
    if (depth === 0) {
      cursor = match.index
      break
    }
    match = tag.exec(html)
  }
  if (depth !== 0) return null
  return {
    version: /data-legal-version="([^"]*)"/i.exec(open[0])?.[1] ?? null,
    html: html.slice(start, cursor),
  }
}

/** @param {string} html */
export function legalDocumentHash(html) {
  const article = extractLegalArticle(html)
  if (article === null) return null
  return {
    version: article.version,
    sha256: createHash("sha256").update(canonicalDocumentText(article.html), "utf8").digest("hex"),
  }
}

/**
 * @param {string} type
 * @param {string} version
 * @param {string} sha256
 */
export function isPlaceholderLegalHash(type, version, sha256) {
  return createHash("sha256").update(`${type}@${version}`, "utf8").digest("hex") === sha256
}

/** @param {string} outDir */
export function renderedLegalDocuments(outDir) {
  const legalOutDir = join(outDir, "legal")
  if (!existsSync(legalOutDir)) return []
  return readdirSync(legalOutDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((route) => existsSync(join(legalOutDir, route, "index.html")))
    .sort()
    .map((route) => {
      const html = readFileSync(join(legalOutDir, route, "index.html"), "utf8")
      return {
        route,
        html,
        type: /data-legal-doc="([^"]*)"/.exec(html)?.[1] ?? null,
        hashed: legalDocumentHash(html),
      }
    })
}
