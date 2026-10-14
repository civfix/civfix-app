import { describe, expect, it } from "vitest"

import { normalizeSiteUrl } from "../src/lib/site-meta"
import {
  NOINDEX_RULE,
  PRODUCTION_SITE_URL,
  isProductionOrigin,
  normalizeSiteOrigin,
  withNoindexRule,
} from "./robots-policy.mjs"

const HEADERS = `/*
  Cache-Control: public, max-age=0, must-revalidate
  X-Content-Type-Options: nosniff

/__spa/*
  X-Robots-Tag: noindex
`

const SHARED_CASES = [
  "https://civfix.org",
  "https://civfix.org/",
  "https://civfix.dev",
  "https://civfix.dev/",
  "  https://civfix.dev/  ",
  "https://civfix.dev/some/path?a=b#c",
  "http://localhost:3000/",
  "",
  "   ",
  "not a url",
  "/relative",
  "javascript:alert(1)",
  "data:text/html,x",
  "file:///etc/passwd",
  undefined,
]

describe("normalizeSiteOrigin", () => {
  it("agrees with the app's normalizeSiteUrl on every input shape", () => {
    for (const value of SHARED_CASES) {
      expect(normalizeSiteOrigin(value)).toBe(normalizeSiteUrl(value))
    }
  })

  it("reduces a configured site url to a bare origin", () => {
    expect(normalizeSiteOrigin("https://civfix.dev/")).toBe("https://civfix.dev")
    expect(normalizeSiteOrigin(undefined)).toBe(PRODUCTION_SITE_URL)
  })
})

describe("isProductionOrigin", () => {
  it("recognizes only the exact production origin", () => {
    expect(isProductionOrigin(PRODUCTION_SITE_URL)).toBe(true)
    for (const origin of [
      "https://civfix.dev",
      "https://www.civfix.org",
      "https://civfix-web.pages.dev",
      "http://civfix.org",
      "https://civfix.org/",
      "https://civfix.org.evil.com",
    ]) {
      expect(isProductionOrigin(origin)).toBe(false)
    }
  })
})

describe("withNoindexRule", () => {
  it("leaves a production export untouched", () => {
    expect(withNoindexRule(HEADERS, PRODUCTION_SITE_URL)).toBe(HEADERS)
  })

  it("appends a /* noindex rule for any non-production origin", () => {
    for (const origin of ["https://civfix.dev", "https://staging.civfix-web.pages.dev"]) {
      const guarded = withNoindexRule(HEADERS, origin)
      expect(guarded).toContain(`/*\n  ${NOINDEX_RULE}`)
      expect(guarded.endsWith("\n")).toBe(true)
    }
  })

  it("keeps every existing rule verbatim", () => {
    const guarded = withNoindexRule(HEADERS, "https://civfix.dev")
    expect(guarded.startsWith(HEADERS.trimEnd())).toBe(true)
    for (const line of [
      "  Cache-Control: public, max-age=0, must-revalidate",
      "  X-Content-Type-Options: nosniff",
      "/__spa/*",
      "  X-Robots-Tag: noindex",
    ]) {
      expect(guarded).toContain(line)
    }
  })

  it("is idempotent, so a re-run never doubles the rule", () => {
    const once = withNoindexRule(HEADERS, "https://civfix.dev")
    const twice = withNoindexRule(once, "https://civfix.dev")
    expect(twice).toBe(once)
    expect(twice.split(NOINDEX_RULE)).toHaveLength(2)
  })
})
