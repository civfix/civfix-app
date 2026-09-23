import { describe, expect, it } from "vitest"

import {
  DEFAULT_SITE_URL,
  PRODUCTION_SITE_URL,
  STAGING_SITE_URL,
  canonicalSiteOriginFor,
  normalizeSiteUrl,
  resolveSiteOrigin,
} from "./site-meta"

describe("normalizeSiteUrl", () => {
  it("reduces the configured site url to a bare origin", () => {
    for (const value of [
      "https://civfix.dev",
      "https://civfix.dev/",
      "  https://civfix.dev/  ",
      "https://civfix.dev/some/path",
      "https://civfix.dev/?a=b#c",
    ]) {
      expect(normalizeSiteUrl(value)).toBe(STAGING_SITE_URL)
    }
  })

  it("never lets a trailing slash double up in a derived asset url", () => {
    expect(`${normalizeSiteUrl("https://civfix.dev/")}/og.png`).toBe("https://civfix.dev/og.png")
  })

  it("keeps an explicit http origin, port and all, for a local build", () => {
    expect(normalizeSiteUrl("http://localhost:3000/")).toBe("http://localhost:3000")
  })

  it("falls back to the default site for a missing, unparseable or opaque-origin value", () => {
    for (const value of [
      "",
      "   ",
      "not a url",
      "/relative",
      "javascript:alert(1)",
      "data:text/html,x",
      "file:///etc/passwd",
      undefined,
      null,
    ]) {
      expect(normalizeSiteUrl(value)).toBe(DEFAULT_SITE_URL)
    }
  })
})

describe("resolveSiteOrigin", () => {
  it("maps every hostname of an environment onto that environment's ONE canonical origin", () => {
    for (const url of [
      "https://civfix.org/pin/abc",
      "https://www.civfix.org/pin/abc",
      "https://civfix-web.pages.dev/pin/abc",
    ]) {
      expect(resolveSiteOrigin(url)).toBe(PRODUCTION_SITE_URL)
    }
    for (const url of [
      "https://civfix.dev/cleanups/abc",
      "https://www.civfix.dev/cleanups/abc",
      "https://staging.civfix-web.pages.dev/cleanups/abc",
    ]) {
      expect(resolveSiteOrigin(url)).toBe(STAGING_SITE_URL)
    }
  })

  it("falls back to the production site for anything else", () => {
    for (const url of [
      "https://civfix.org.evil.com/pin/abc",
      "https://a1b2c3d4.civfix-web.pages.dev/pin/abc",
      "https://civfix-web.pages.dev.evil.com/pin/abc",
      "https://evilcivfix-web.pages.dev.attacker.example/pin/abc",
      "https://attacker.example/pin/abc",
      "http://civfix.org/pin/abc",
      "https://civfix.org:8443/pin/abc",
      "not a url",
      "",
      null,
      undefined,
    ]) {
      expect(resolveSiteOrigin(url)).toBe(DEFAULT_SITE_URL)
    }
  })

  it("never lets a port, credentials or a path widen the origin", () => {
    expect(resolveSiteOrigin("https://user:pass@civfix.org/pin/abc")).toBe(PRODUCTION_SITE_URL)
    expect(resolveSiteOrigin("https://civfix.org/pin/abc?next=https://evil.example")).toBe(
      PRODUCTION_SITE_URL,
    )
  })

  it("matches hostnames exactly, with no suffix or substring rule", () => {
    expect(canonicalSiteOriginFor("civfix.org")).toBe(PRODUCTION_SITE_URL)
    expect(canonicalSiteOriginFor("staging.civfix-web.pages.dev")).toBe(STAGING_SITE_URL)
    expect(canonicalSiteOriginFor("dev.civfix-web.pages.dev")).toBeNull()
    expect(canonicalSiteOriginFor("preview.civfix-web.pages.dev")).toBeNull()
    expect(canonicalSiteOriginFor("civfix.org.evil.com")).toBeNull()
    expect(canonicalSiteOriginFor("notcivfix.dev")).toBeNull()
    expect(DEFAULT_SITE_URL).toBe(PRODUCTION_SITE_URL)
  })
})
