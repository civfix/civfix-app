import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import {
  PERVASIVE_HEADERS,
  cspDirective,
  parseHeaderBlock,
  parsePervasiveHeaders,
} from "./edge-headers"

const headersFile = readFileSync(
  fileURLToPath(new URL("../../public/_headers", import.meta.url)),
  "utf8",
)

describe("pervasive edge headers", () => {
  it("matches the /* block of public/_headers", () => {
    expect(parsePervasiveHeaders(headersFile)).toEqual({ ...PERVASIVE_HEADERS })
  })

  it("still carries the security headers a Pages Function must re-apply", () => {
    for (const key of [
      "Content-Security-Policy",
      "Strict-Transport-Security",
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
      "Cross-Origin-Opener-Policy",
      "Permissions-Policy",
    ]) {
      expect(PERVASIVE_HEADERS[key]).toBeTruthy()
    }
  })

  it("ignores other blocks and comments", () => {
    const parsed = parsePervasiveHeaders(
      ["# note", "/*", "  A: 1", "", "/_next/static/*", "  ! Cache-Control", "  B: 2"].join("\n"),
    )
    expect(parsed).toEqual({ A: "1" })
  })

  it("reports the drops of any block", () => {
    const parsed = parseHeaderBlock(
      ["/x/*", "  ! Content-Security-Policy", "  A: 1"].join("\n"),
      "/x/*",
    )
    expect(parsed).toEqual({ headers: { A: "1" }, drops: ["Content-Security-Policy"] })
  })
})

describe("the platform processes no payments", () => {
  it("names no payment-processor origin anywhere in public/_headers", () => {
    expect(headersFile).not.toContain("stripe.com")
  })

  it("keeps no /donate/* block", () => {
    expect(parseHeaderBlock(headersFile, "/donate/*")).toEqual({ headers: {}, drops: [] })
  })

  it("hard-blocks the Payment Request API on every route", () => {
    expect(PERVASIVE_HEADERS["Permissions-Policy"]).toContain("payment=()")
    for (const line of headersFile.split("\n")) {
      if (line.trimStart().startsWith("Permissions-Policy:")) expect(line).toContain("payment=()")
    }
  })

  it("keeps every hardening directive in the pervasive policy", () => {
    const policy = PERVASIVE_HEADERS["Content-Security-Policy"] as string
    expect(cspDirective(policy, "frame-ancestors")).toEqual(["'none'"])
    expect(cspDirective(policy, "object-src")).toEqual(["'none'"])
    expect(cspDirective(policy, "base-uri")).toEqual(["'self'"])
    expect(cspDirective(policy, "default-src")).toEqual(["'self'"])
    expect(cspDirective(policy, "form-action")).toEqual(["'self'"])
  })

  it("ships no Report-Only copy, which would collect nothing without a report endpoint", () => {
    expect(headersFile).not.toMatch(/^\s+Content-Security-Policy-Report-Only:/m)
  })
})
