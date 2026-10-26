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

export function leakedDevRoutes(outEntries) {
  const names = new Set(outEntries)
  return DEV_ONLY_ROUTES.filter((route) => names.has(route) || names.has(`${route}.html`))
}

export function spaFallbackGaps(shellRoutes, redirects) {
  const rules = new Set()
  for (const raw of redirects.split("\n")) {
    const line = raw.trim()
    if (line.length === 0 || line.startsWith("#")) continue
    const [from] = line.split(/\s+/)
    if (from === undefined) continue
    const match = /^\/([^/*\s]+)\/\*$/.exec(from)
    if (match) rules.add(match[1])
  }
  return shellRoutes.filter((route) => !rules.has(route)).sort()
}

function detailEntries(association) {
  const details = association?.applinks?.details
  return Array.isArray(details) ? details : []
}

export function aasaExcludeOrder(association) {
  const details = detailEntries(association)
  if (details.length === 0) {
    return { ok: false, reason: "no-components", catchAllIndex: -1, lateExcludes: [] }
  }
  for (const [index, detail] of details.entries()) {
    const components = detail?.components
    if (!Array.isArray(components)) {
      return { ok: false, reason: `no-components (details[${index}])`, catchAllIndex: -1, lateExcludes: [] }
    }
    const catchAllIndex = components.findIndex(
      (entry) => entry?.["/"] === "/*" && entry?.exclude !== true,
    )
    if (catchAllIndex === -1) continue
    const lateExcludes = components
      .slice(catchAllIndex + 1)
      .filter((entry) => entry?.exclude === true)
      .map((entry) => String(entry?.["/"] ?? "?"))
    if (lateExcludes.length > 0) {
      return {
        ok: false,
        reason: `exclude-after-catch-all (details[${index}])`,
        catchAllIndex,
        lateExcludes,
      }
    }
  }
  const anyCatchAll = details.some((detail) =>
    (Array.isArray(detail?.components) ? detail.components : []).some(
      (entry) => entry?.["/"] === "/*" && entry?.exclude !== true,
    ),
  )
  if (!anyCatchAll) {
    return { ok: false, reason: "no-catch-all", catchAllIndex: -1, lateExcludes: [] }
  }
  return { ok: true, reason: null, catchAllIndex: 0, lateExcludes: [] }
}

export function missingAasaExcludes(association, required) {
  const details = detailEntries(association)
  if (details.length === 0) return [...required]
  const missing = new Set()
  for (const detail of details) {
    const components = Array.isArray(detail?.components) ? detail.components : []
    const present = new Set(
      components
        .filter((entry) => entry?.exclude === true)
        .map((entry) => String(entry?.["/"] ?? "")),
    )
    for (const pattern of required) if (!present.has(pattern)) missing.add(pattern)
  }
  return required.filter((pattern) => missing.has(pattern))
}
