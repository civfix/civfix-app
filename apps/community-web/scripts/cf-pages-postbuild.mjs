
import {
  existsSync,
  readFileSync,
  readdirSync,
  mkdirSync,
  copyFileSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

import { LEGAL_DOCUMENTS } from "@civfix/shared/legal"

import {
  NOINDEX_RULE,
  isProductionOrigin,
  normalizeSiteOrigin,
  withNoindexRule,
} from "./robots-policy.mjs"
import {
  aasaExcludeOrder,
  isPlaceholderLegalHash,
  leakedDevRoutes,
  legalDocumentHash,
  missingAasaExcludes,
  spaFallbackGaps,
} from "./postbuild-gates.mjs"

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..")
const outDir = join(appDir, "out")

if (!existsSync(outDir)) {
  console.error(`[cf-pages] no export found at ${outDir}; run \`next build\` first.`)
  process.exit(1)
}

const leakedDev = leakedDevRoutes(readdirSync(outDir))
if (leakedDev.length > 0) {
  console.error(
    `[cf-pages] ERROR: dev-only gallery route(s) reached the export: ${leakedDev.join(", ")}. They ` +
      `must stay \`page.dev.tsx\` / \`layout.dev.tsx\`, which only \`next dev\` treats as routes ` +
      `(pageExtensionsFor in apps/community-web/next.config.mjs).`,
  )
  process.exit(1)
}

const collisions = readdirSync(outDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
  .map((entry) => entry.name)
  .filter(
    (route) =>
      existsSync(join(outDir, route, "index.html")) &&
      existsSync(join(outDir, route, "_", "index.html")),
  )
  .sort()

for (const route of collisions) {
  const dest = join(outDir, "__spa", route)
  mkdirSync(dest, { recursive: true })
  copyFileSync(join(outDir, route, "index.html"), join(dest, "index.html"))
}

console.log(
  `[cf-pages] wrote ${collisions.length} browse fallback shell(s) to out/__spa/: ` +
    `${collisions.join(", ") || "(none)"}`,
)

const redirects = existsSync(join(outDir, "_redirects"))
  ? readFileSync(join(outDir, "_redirects"), "utf8")
  : ""
const unprotected = collisions.filter((route) => !new RegExp(`^/${route}/\\s`, "m").test(redirects))

if (unprotected.length > 0) {
  console.error(
    `[cf-pages] ERROR: these routes have a browse page the SPA fallback will shadow, but no ` +
      `protective rule in out/_redirects: ${unprotected.join(", ")}. Add ` +
      `\`/<route>/   /__spa/<route>/   200\` to apps/community-web/public/_redirects.`,
  )
  process.exit(1)
}

const siteOrigin = normalizeSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL)
const productionBuild = isProductionOrigin(siteOrigin)

const shellRoutes = readdirSync(outDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
  .map((entry) => entry.name)
  .filter((route) => existsSync(join(outDir, route, "_", "index.html")))
  .sort()

const unreachableShells = spaFallbackGaps(shellRoutes, redirects)

if (unreachableShells.length > 0) {
  console.error(
    `[cf-pages] ERROR: these routes export a catch-all placeholder shell at ` +
      `out/<route>/_/index.html but have no \`/<route>/* -> /<route>/_/ 200\` rule in ` +
      `out/_redirects: ${unreachableShells.join(", ")}. Cloudflare would answer every deep link ` +
      `under them with a 404, because a static export cannot enumerate real ids. Add the rule to ` +
      `apps/community-web/public/_redirects.`,
  )
  process.exit(1)
}

console.log(
  `[cf-pages] SPA fallback complete for ${shellRoutes.length} catch-all shell(s): ` +
    `${shellRoutes.join(", ") || "(none)"}.`,
)

const AASA_RELATIVE = join(".well-known", "apple-app-site-association")
const aasaOut = join(outDir, AASA_RELATIVE)
const aasaSource = join(appDir, "public", AASA_RELATIVE)

if (!existsSync(aasaOut) && existsSync(aasaSource)) {
  mkdirSync(dirname(aasaOut), { recursive: true })
  copyFileSync(aasaSource, aasaOut)
  console.log(`[cf-pages] copied ${AASA_RELATIVE} into the export (next did not emit it).`)
}

if (!existsSync(aasaOut)) {
  console.error(
    `[cf-pages] ERROR: ${AASA_RELATIVE} is missing from the export AND from ` +
      `${relative(appDir, aasaSource)}. Without it iOS Universal Links are dead: every ` +
      `https://civfix.org/... link opens in Safari instead of the civfix app. Restore ` +
      `apps/community-web/public/.well-known/apple-app-site-association.`,
  )
  process.exit(1)
}

try {
  JSON.parse(readFileSync(aasaOut, "utf8"))
} catch (error) {
  console.error(
    `[cf-pages] ERROR: ${AASA_RELATIVE} is not valid JSON (${error.message}). iOS rejects a ` +
      `malformed association file outright, disabling Universal Links site-wide.`,
  )
  process.exit(1)
}

const REQUIRED_AASA_EXCLUDES = [
  "/legal/*",
  "/service-record/*",
  "/guest*",
  "/claim*",
  "/manage*",
  "/e/*",
  "/unsubscribe*",
]

const association = JSON.parse(readFileSync(aasaOut, "utf8"))
const missingExcludes = missingAasaExcludes(association, REQUIRED_AASA_EXCLUDES)

if (missingExcludes.length > 0) {
  console.error(
    `[cf-pages] ERROR: ${AASA_RELATIVE} is missing required exclude(s): ` +
      `${missingExcludes.join(", ")}. Without them iOS claims those paths as Universal Links and ` +
      `opens the civfix app instead of the browser - which breaks the host console, the public ` +
      `signup page and one-click unsubscribe.`,
  )
  process.exit(1)
}

const excludeOrder = aasaExcludeOrder(association)

if (!excludeOrder.ok) {
  console.error(
    `[cf-pages] ERROR: ${AASA_RELATIVE} exclude ordering is wrong (${excludeOrder.reason}` +
      `${excludeOrder.lateExcludes.length > 0 ? `: ${excludeOrder.lateExcludes.join(", ")}` : ""}). ` +
      `iOS evaluates components IN ORDER and stops at the FIRST match, so every ` +
      `{"exclude": true} entry must appear BEFORE the {"/": "/*"} catch-all. An exclude listed after ` +
      `it is dead configuration that reads as if it works.`,
  )
  process.exit(1)
}

console.log(`[cf-pages] ${AASA_RELATIVE} present and parseable.`)

const ROUTES_FILE = "_routes.json"
const routesPath = join(outDir, ROUTES_FILE)

if (!existsSync(routesPath)) {
  console.error(
    `[cf-pages] ERROR: ${ROUTES_FILE} is missing from the export. Restore ` +
      `apps/community-web/public/${ROUTES_FILE}; without it Cloudflare routes EVERY request through ` +
      `the Pages Functions, including static assets.`,
  )
  process.exit(1)
}

const routes = JSON.parse(readFileSync(routesPath, "utf8"))
const functionsDir = join(appDir, "functions")

for (const include of routes.include ?? []) {
  const prefix = include.replace(/\/\*$/, "").replace(/^\//, "")
  const handler = join(functionsDir, prefix, "[[path]].ts")
  if (!existsSync(handler)) {
    console.error(
      `[cf-pages] ERROR: ${ROUTES_FILE} routes "${include}" through a Pages Function, but ` +
        `${relative(appDir, handler)} does not exist. Cloudflare would then hand those detail deep ` +
        `links to nothing. Add the handler or drop the include.`,
    )
    process.exit(1)
  }
}

const includePrefixes = (routes.include ?? []).map((include) =>
  include.replace(/\/\*$/, "").replace(/^\//, ""),
)
const excluded = new Set(
  (routes.exclude ?? []).map((rule) => rule.replace(/\/$/, "").replace(/^\//, "")),
)
const unexcluded = collisions
  .filter((route) => includePrefixes.includes(route))
  .filter((route) => !excluded.has(route))

if (unexcluded.length > 0) {
  console.error(
    `[cf-pages] ERROR: these routes have a real browse page at out/<route>/index.html AND are ` +
      `routed through a Pages Function by ${ROUTES_FILE} "include", but are not listed in its ` +
      `"exclude": ${unexcluded.join(", ")}. The Function would then intercept the BROWSE page and ` +
      `serve the empty detail shell instead of the listing. Add ` +
      `"/<route>/" to the "exclude" array in apps/community-web/public/${ROUTES_FILE}.`,
  )
  process.exit(1)
}

const OG_IMAGE = "og.png"
const OG_IMAGE_MAX_BYTES = 300 * 1024
const SHARE_ASSETS = [OG_IMAGE, "apple-touch-icon.png"]

for (const asset of SHARE_ASSETS) {
  if (!existsSync(join(outDir, asset))) {
    console.error(
      `[cf-pages] ERROR: ${asset} is missing from the export. The share-card artwork is the default ` +
        `og:image / touch icon for every page and the fallback for every entity preview, so a shared ` +
        `civfix.org link would unfurl with no image at all (iMessage then shows a bare Safari icon). ` +
        `Regenerate both with \`pnpm --filter community-web og-image\`.`,
    )
    process.exit(1)
  }
  const prefixed = (routes.include ?? []).some((include) =>
    `/${asset}`.startsWith(include.replace(/\*$/, "")),
  )
  if (prefixed) {
    console.error(
      `[cf-pages] ERROR: ${ROUTES_FILE} routes /${asset} through a Pages Function. The share-card ` +
        `artwork must be served straight off the asset server so crawlers get one un-redirected ` +
        `image/png response. Narrow the "include" list.`,
    )
    process.exit(1)
  }
}

const ogBytes = statSync(join(outDir, OG_IMAGE)).size
if (ogBytes > OG_IMAGE_MAX_BYTES) {
  console.error(
    `[cf-pages] ERROR: ${OG_IMAGE} is ${ogBytes} bytes, over the ${OG_IMAGE_MAX_BYTES}-byte budget. ` +
      `WhatsApp silently drops a preview image above ~300 KB. Regenerate a smaller one with ` +
      `\`pnpm --filter community-web og-image\`.`,
  )
  process.exit(1)
}

console.log(
  `[cf-pages] link previews OK (${ROUTES_FILE} -> ${(routes.include ?? []).join(", ")}, ` +
    `${SHARE_ASSETS.join(" + ")} present, ${OG_IMAGE} ${ogBytes} bytes).`,
)

const BRANDED_HEAD_PAGES = ["index.html", "404.html"]
const BRANDED_HEAD_TAGS = [
  /<meta property="og:site_name" content="civfix"\/?>/,
  /<meta property="og:type" content="website"\/?>/,
  /<meta property="og:locale" content="en_US"\/?>/,
  /<meta property="og:title" content="civfix"\/?>/,
  /<meta property="og:description" content="[^"]+"\/?>/,
  /<meta property="og:image" content="https:\/\/[^"]+\/og\.png"\/?>/,
  /<meta property="og:image:secure_url" content="https:\/\/[^"]+\/og\.png"\/?>/,
  /<meta property="og:image:type" content="image\/png"\/?>/,
  /<meta property="og:image:width" content="1200"\/?>/,
  /<meta property="og:image:height" content="630"\/?>/,
  /<meta property="og:image:alt" content="civfix"\/?>/,
  /<meta name="twitter:card" content="summary_large_image"\/?>/,
  /<meta name="twitter:title" content="civfix"\/?>/,
  /<meta name="twitter:description" content="[^"]+"\/?>/,
  /<meta name="twitter:image" content="https:\/\/[^"]+\/og\.png"\/?>/,
  /<link rel="apple-touch-icon"[^>]*href="\/apple-touch-icon\.png"[^>]*\/?>/,
]

for (const page of BRANDED_HEAD_PAGES) {
  const file = join(outDir, page)
  if (!existsSync(file)) {
    console.error(
      `[cf-pages] ERROR: ${page} is missing from the export, so the branded default link-preview ` +
        `head this check guards does not exist. Restore the route that emits it.`,
    )
    process.exit(1)
  }
  const head = readFileSync(file, "utf8").split("</head>")[0] ?? ""
  const missing = BRANDED_HEAD_TAGS.filter((tag) => !tag.test(head)).map((tag) => tag.source)
  if (missing.length > 0) {
    console.error(
      `[cf-pages] ERROR: ${page} is missing branded link-preview tags: ${missing.join(", ")}. ` +
        `Every page that is NOT handled by a Pages Function unfurls from this head alone, so a gap ` +
        `here is a bare-URL card in iMessage/WhatsApp/Slack. Fix the metadata in ` +
        `src/app/layout.tsx.`,
    )
    process.exit(1)
  }
}

console.log(
  `[cf-pages] branded default head OK on ${BRANDED_HEAD_PAGES.join(" + ")} ` +
    `(${BRANDED_HEAD_TAGS.length} tags each).`,
)

const HEADERS_FILE = "_headers"
const headersPath = join(outDir, HEADERS_FILE)

if (!existsSync(headersPath)) {
  console.error(
    `[cf-pages] ERROR: ${HEADERS_FILE} is missing from the export. Restore ` +
      `apps/community-web/public/${HEADERS_FILE}; without it every response loses the security ` +
      `header block AND a non-production build loses its ${NOINDEX_RULE} rule.`,
  )
  process.exit(1)
}

const headers = readFileSync(headersPath, "utf8")
const guardedHeaders = withNoindexRule(headers, siteOrigin)

if (guardedHeaders !== headers) writeFileSync(headersPath, guardedHeaders)

console.log(
  productionBuild
    ? `[cf-pages] robots policy: ${siteOrigin} is the production origin, export stays indexable ` +
        `(no ${NOINDEX_RULE} rule in ${HEADERS_FILE}).`
    : `[cf-pages] robots policy: ${siteOrigin} is NOT production, ${HEADERS_FILE} now serves ` +
        `"${NOINDEX_RULE}" on /* so no staging URL is indexed as a duplicate of civfix.org.`,
)

const legalOutDir = join(outDir, "legal")
const legalRoutes = existsSync(legalOutDir)
  ? readdirSync(legalOutDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((route) => existsSync(join(legalOutDir, route, "index.html")))
      .sort()
  : []

const legalDrift = []
const legalPlaceholders = []
const legalRendered = new Map()

for (const route of legalRoutes) {
  const html = readFileSync(join(legalOutDir, route, "index.html"), "utf8")
  const type = /data-legal-doc="([^"]*)"/.exec(html)?.[1] ?? null
  if (type === null) continue
  const hashed = legalDocumentHash(html)
  if (hashed === null) continue
  legalRendered.set(type, { route, ...hashed })

  const declared = LEGAL_DOCUMENTS.find((document) => document.type === type)
  if (declared === undefined) {
    legalDrift.push(`${type}: rendered at /legal/${route}/ but absent from LEGAL_DOCUMENTS`)
    continue
  }
  if (hashed.version !== declared.version) {
    legalDrift.push(
      `${type}: page renders version ${hashed.version ?? "(none)"} but LEGAL_DOCUMENTS says ` +
        `${declared.version}`,
    )
    continue
  }
  if (isPlaceholderLegalHash(type, declared.version, declared.sha256)) {
    legalPlaceholders.push(`${type} -> ${hashed.sha256}`)
    continue
  }
  if (hashed.sha256 !== declared.sha256) {
    legalDrift.push(
      `${type}: rendered sha256 ${hashed.sha256} != LEGAL_DOCUMENTS ${declared.sha256}`,
    )
  }
}

const legalRoutesMissingStamp = legalRoutes.filter((route) => {
  const html = readFileSync(join(legalOutDir, route, "index.html"), "utf8")
  return !/data-legal-doc="[^"]+"/.test(html) || legalDocumentHash(html) === null
})

if (legalRoutesMissingStamp.length > 0) {
  console.error(
    `[cf-pages] ERROR: these /legal/ routes render a page but carry no hashable legal document: ` +
      `${legalRoutesMissingStamp.join(", ")}. Every /legal/<slug>/ page must render its content inside ` +
      `<article class="legal-prose"> with data-legal-doc + data-legal-version (components/legal/legal-page.tsx ` +
      `does this). Without the stamp the drift gate silently SKIPS the document, which is worse than no ` +
      `gate: consent records would keep claiming a hash nothing verifies. If a route is deliberately not a ` +
      `versioned legal document, move it out of /legal/.`,
  )
  process.exit(1)
}

const declaredWebTypes = LEGAL_DOCUMENTS.map((document) => document.type)
const unrenderedTypes = declaredWebTypes.filter((type) => !legalRendered.has(type))

if (legalDrift.length > 0) {
  console.error(
    `[cf-pages] ERROR: legal document drift:\n  ${legalDrift.join("\n  ")}\n` +
      `  consent_records.document_sha256 is the evidence that a donor accepted THAT EXACT TEXT ` +
      `and the backend validates consent payloads against @civfix/shared/legal. A page ` +
      `whose text moved without its version and hash moving with it makes every consent record ` +
      `written since unverifiable. Run \`node scripts/legal-hashes.mjs\` and update ` +
      `packages/shared/src/legal/documents.ts (version, effectiveAt and sha256 change ` +
      `as ONE edit).`,
  )
  process.exit(1)
}

if (unrenderedTypes.length > 0) {
  console.error(
    `[cf-pages] ERROR: these legal document types are declared in @civfix/shared/legal but no ` +
      `/legal/<slug>/ page renders them: ${unrenderedTypes.join(", ")}. Every versioned document ` +
      `must be rendered somewhere this gate can hash it, or the sha256 a consent record cites is ` +
      `a number that verifies no text. Add the page (components/legal/legal-page.tsx) and its ` +
      `LegalDocId, or remove the type from LEGAL_DOCUMENTS.`,
  )
  process.exit(1)
}

if (legalPlaceholders.length > 0) {
  console.error(
    `[cf-pages] ERROR: these legal documents still carry the sha256("<type>@<version>") ` +
      `PLACEHOLDER hash in @civfix/shared/legal:\n  ${legalPlaceholders.join("\n  ")}\n` +
      `  A placeholder hashes no document, so a consent record citing it is unverifiable evidence. ` +
      `Paste the real hashes (printed above, and by \`node scripts/legal-hashes.mjs\`) into ` +
      `packages/shared/src/legal/documents.ts - version, effectiveAt and sha256 move ` +
      `as ONE edit - and mirror them into the backend legal seed ` +
      `migration.`,
  )
  process.exit(1)
}

console.log(
  `[cf-pages] legal documents checked: ${legalRendered.size} rendered and hash-matched, ` +
    `0 placeholders, 0 unrendered.`,
)

const APP_ERROR_IDENTITY_MARKER = /\.name\s*=\s*(["'])AppError\1/g
const SCRIPT_EXTENSIONS = [".js", ".mjs", ".cjs"]
const chunksDir = join(outDir, "_next", "static", "chunks")

function scriptFilesUnder(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return scriptFilesUnder(full)
    const isScript = SCRIPT_EXTENSIONS.some((ext) => entry.name.endsWith(ext))
    return entry.isFile() && isScript ? [full] : []
  })
}

const appErrorSites = scriptFilesUnder(chunksDir)
  .map((file) => ({
    file: relative(appDir, file),
    count: (readFileSync(file, "utf8").match(APP_ERROR_IDENTITY_MARKER) ?? []).length,
  }))
  .filter((site) => site.count > 0)

const appErrorCopies = appErrorSites.reduce((total, site) => total + site.count, 0)

const WHY_ONE_COPY =
  `@civfix/shared builds every entry with \`splitting: false\` (packages/shared/tsup.config.ts), so ` +
  `src/types/errors.ts is INLINED into BOTH dist/index.js and dist/client/index.js. Bundle those two ` +
  `entries as separate modules and the app ends up with two DISTINCT AppError classes: ` +
  `\`err instanceof AppError\` is then ALWAYS false across the boundary, the typed client's ` +
  `normalizeError re-wraps EVERY API error as INTERNAL, and every error-code branch in the UI - rate ` +
  `limit, validation, conflict, abuse hold, not-routable - collapses into the generic outage state, ` +
  `app-wide. It type-checks, it lints, and the unit tests pass, because nothing but the real emitted ` +
  `bytes can see it. That is why this is asserted here.`

const HOW_IT_IS_HELD =
  `The invariant is held by the \`"@civfix/shared/client$": sharedContractDir\` entry in ` +
  `resolve.alias in apps/community-web/next.config.mjs, which collapses the client subpath onto the ` +
  `package root so both import paths resolve to ONE module. If you removed, reordered or rewrote that ` +
  `alias, restore it. It MUST keep the \`$\` (exact-match) suffix: webpack's AliasPlugin skips any ` +
  `alias whose target is a PREFIX of the request, so the intuitive prefix form silently does nothing.`

if (appErrorCopies > 1) {
  console.error(
    `[cf-pages] ERROR: the client bundle contains ${appErrorCopies} copies of the AppError class ` +
      `(expected exactly 1): ${appErrorSites.map((site) => `${site.file} x${site.count}`).join(", ")}.\n` +
      `  ${WHY_ONE_COPY}\n` +
      `  ${HOW_IT_IS_HELD}\n` +
      `  If the alias is intact, look for a NEW deep import of some other @civfix/shared subpath: any ` +
      `subpath entry that re-inlines errors.ts needs its own exact-match alias alongside it.`,
  )
  process.exit(1)
}

if (appErrorCopies === 0) {
  console.error(
    `[cf-pages] ERROR: no AppError class definition found under ${relative(appDir, chunksDir)} ` +
      `(expected exactly 1). This check asserts that the app bundles exactly ONE copy of ` +
      `@civfix/shared's AppError. ${WHY_ONE_COPY}\n` +
      `  Zero matches means the check has gone BLIND, not that the app is healthy: either ` +
      `@civfix/shared is no longer bundled at all, or the constructor's \`this.name = "AppError"\` ` +
      `identity stamp - the minification-proof marker this check counts, one per physical copy of the ` +
      `class - changed shape upstream.\n` +
      `  Do not delete this check. Confirm what the built class looks like now with ` +
      `\`grep -o '.\\{200\\}AppError.\\{200\\}' out/_next/static/chunks/*.js\` and update ` +
      `APP_ERROR_IDENTITY_MARKER in this file to match.`,
  )
  process.exit(1)
}

console.log(`[cf-pages] AppError single-instance check OK (1 copy, in ${appErrorSites[0].file}).`)
