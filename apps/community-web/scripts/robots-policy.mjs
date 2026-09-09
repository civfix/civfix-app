export const PRODUCTION_SITE_URL = "https://civfix.org"

export const NOINDEX_RULE = "X-Robots-Tag: noindex, nofollow"

export const NOINDEX_BLOCK = [
  "# --- Non-production export: keep the whole site out of search indexes. ---",
  "# Appended by scripts/cf-pages-postbuild.mjs when the build's site origin is not",
  `# ${PRODUCTION_SITE_URL}. Staging serves the same civic content on a second public hostname, so`,
  "# without this every staging URL is an indexable duplicate of production. This is export-wide on",
  "# purpose: the three preview routes emit their own noindex meta, but every other page needs the",
  "# header. The comma-join with /__spa/* (see MERGE SEMANTICS above) yields a repeated noindex",
  "# directive, which is a harmless no-op rather than the corrupt value a joined Cache-Control is.",
  "/*",
  `  ${NOINDEX_RULE}`,
].join("\n")

export function normalizeSiteOrigin(value) {
  const raw = value?.trim()
  if (!raw) return PRODUCTION_SITE_URL
  let parsed
  try {
    parsed = new URL(raw)
  } catch {
    return PRODUCTION_SITE_URL
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return PRODUCTION_SITE_URL
  return parsed.origin
}

export function isProductionOrigin(siteOrigin) {
  return siteOrigin === PRODUCTION_SITE_URL
}

export function withNoindexRule(headers, siteOrigin) {
  if (isProductionOrigin(siteOrigin)) return headers
  if (headers.includes(NOINDEX_RULE)) return headers
  return `${headers.replace(/\s+$/, "")}\n\n${NOINDEX_BLOCK}\n`
}
