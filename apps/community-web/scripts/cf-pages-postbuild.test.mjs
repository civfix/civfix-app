import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { LEGAL_DOCUMENTS } from "@civfix/shared/legal"

import {
  aasaExcludeOrder,
  canonicalDocumentText,
  extractLegalArticle,
  isPlaceholderLegalHash,
  legalDocumentHash,
  missingAasaExcludes,
  spaFallbackGaps,
} from "./postbuild-gates.mjs"

const appDir = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const publicDir = join(appDir, "public")

const redirects = readFileSync(join(publicDir, "_redirects"), "utf8")
const association = JSON.parse(
  readFileSync(join(publicDir, ".well-known", "apple-app-site-association"), "utf8"),
)

const REQUIRED_EXCLUDES = [
  "/legal/*",
  "/service-record/*",
  "/guest*",
  "/claim*",
  "/manage*",
  "/e/*",
  "/unsubscribe*",
]

describe("SPA-fallback completeness gate", () => {
  it("passes for the committed _redirects and the routes that ship a placeholder shell", () => {
    const shipped = ["pin", "cleanups", "people", "messages", "groups", "channels", "post", "compose", "leaderboard", "service-record", "manage", "e", "orgs"]
    expect(spaFallbackGaps(shipped, redirects)).toEqual([])
  })

  it("names a shell with no rule, which would 404 every deep link under it", () => {
    expect(spaFallbackGaps(["pin", "campaigns"], redirects)).toEqual(["campaigns"])
  })

  it("does not accept a protective /<route>/ rule as a deep-link fallback", () => {
    const onlyProtective = "/orgs/   /__spa/orgs/   200\n"
    expect(spaFallbackGaps(["orgs"], onlyProtective)).toEqual(["orgs"])
  })

  it("ignores comments", () => {
    expect(spaFallbackGaps(["orgs"], "# /orgs/*   /orgs/_/   200\n")).toEqual(["orgs"])
  })
})

describe("AASA gate", () => {
  it("passes for the committed association file", () => {
    expect(missingAasaExcludes(association, REQUIRED_EXCLUDES)).toEqual([])
    expect(aasaExcludeOrder(association).ok).toBe(true)
  })

  it("names a missing exclude", () => {
    expect(missingAasaExcludes(association, ["/nope*"])).toEqual(["/nope*"])
  })

  it("fails when an exclude sits AFTER the catch-all, where iOS never reaches it", () => {
    const broken = {
      applinks: {
        details: [
          {
            components: [{ "/": "/*" }, { "/": "/nope/*", exclude: true }],
          },
        ],
      },
    }
    const verdict = aasaExcludeOrder(broken)
    expect(verdict.ok).toBe(false)
    expect(verdict.reason).toContain("exclude-after-catch-all")
    expect(verdict.lateExcludes).toEqual(["/nope/*"])
  })

  it("fails when there is no catch-all at all", () => {
    expect(aasaExcludeOrder({ applinks: { details: [{ components: [] }] } }).ok).toBe(false)
    expect(aasaExcludeOrder({}).reason).toBe("no-components")
  })

  it("checks EVERY appID entry, not just the first", () => {
    const association = {
      applinks: {
        details: [
          { components: [{ "/": "/nope/*", exclude: true }, { "/": "/*" }] },
          { components: [{ "/": "/*" }, { "/": "/nope/*", exclude: true }] },
        ],
      },
    }
    const verdict = aasaExcludeOrder(association)
    expect(verdict.ok).toBe(false)
    expect(verdict.reason).toContain("details[1]")
    expect(missingAasaExcludes(association, ["/manage*"])).toEqual(["/manage*"])
  })
})

describe("legal document hashing", () => {
  const html = [
    "<html><head><title>x</title></head><body>",
    '<article class="legal-prose" data-legal-doc="terms" data-legal-version="2026-09-06">',
    "<section><h2>1. Heading</h2><p>First   paragraph &amp; more.</p></section>",
    "<script>ignored()</script>",
    "</article></body></html>",
  ].join("\n")

  it("extracts the article, its version and a stable hash", () => {
    const article = extractLegalArticle(html)
    expect(article?.version).toBe("2026-09-06")
    const hashed = legalDocumentHash(html)
    expect(hashed?.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(legalDocumentHash(html)?.sha256).toBe(hashed?.sha256)
  })

  it("hashes text, not markup, so a purely presentational change does not invalidate consent", () => {
    const restyled = html.replace("<section>", '<section class="tidy">')
    expect(legalDocumentHash(restyled)?.sha256).toBe(legalDocumentHash(html)?.sha256)
  })

  it("changes when a single word of the document changes", () => {
    const edited = html.replace("First", "Second")
    expect(legalDocumentHash(edited)?.sha256).not.toBe(legalDocumentHash(html)?.sha256)
  })

  it("ignores the version attribute, so a version bump alone is not a content change", () => {
    const bumped = html.replace('data-legal-version="2026-09-06"', 'data-legal-version="2027-01-01"')
    expect(legalDocumentHash(bumped)?.sha256).toBe(legalDocumentHash(html)?.sha256)
  })

  it("decodes entities and collapses whitespace", () => {
    expect(canonicalDocumentText("<p>a &amp;  b</p><p>c</p>")).toBe("a & b\nc")
  })

  it("drops scripts and styles rather than hashing them", () => {
    expect(canonicalDocumentText("<p>a</p><script>evil()</script>")).toBe("a")
  })

  it("returns null when there is no legal article to hash", () => {
    expect(legalDocumentHash("<html><body><p>nope</p></body></html>")).toBe(null)
  })
})

describe("legal placeholder detection", () => {
  it("recognizes the sha256(type@version) placeholders the contract still carries", () => {
    for (const document of LEGAL_DOCUMENTS) {
      const placeholder = createHash("sha256")
        .update(`${document.type}@${document.version}`, "utf8")
        .digest("hex")
      expect(isPlaceholderLegalHash(document.type, document.version, placeholder)).toBe(true)
    }
  })

  it("does not mistake a real content hash for a placeholder", () => {
    expect(isPlaceholderLegalHash("terms", "2026-09-06", "0".repeat(64))).toBe(false)
  })
})
