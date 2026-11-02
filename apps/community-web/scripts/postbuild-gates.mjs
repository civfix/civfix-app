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
