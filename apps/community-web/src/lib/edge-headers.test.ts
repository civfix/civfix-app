import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import {
  DONATE_HEADERS,
  DONATE_HEADERS_PATH,
  DONATE_HEADER_DROPS,
  PERVASIVE_HEADERS,
  STRIPE_FORM_ACTION_ORIGINS,
  STRIPE_FRAME_ORIGINS,
  STRIPE_SCRIPT_ORIGINS,
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

describe("donate edge headers", () => {
  const block = parseHeaderBlock(headersFile, DONATE_HEADERS_PATH)

  it("matches the /donate/* block of public/_headers", () => {
    expect(block.headers).toEqual({ ...DONATE_HEADERS })
  })

  it("ships no Report-Only copy, which would collect nothing without a report endpoint", () => {
    expect(block.headers["Content-Security-Policy-Report-Only"]).toBeUndefined()
    expect(headersFile).not.toMatch(/^\s+Content-Security-Policy-Report-Only:/m)
  })

  it("drops the inherited policies before restating them", () => {
    expect([...block.drops].sort()).toEqual([...DONATE_HEADER_DROPS].sort())
  })

  it("allows Stripe's script, frame and form-action origins", () => {
    const policy = DONATE_HEADERS["Content-Security-Policy"] as string
    for (const origin of STRIPE_SCRIPT_ORIGINS) {
      expect(cspDirective(policy, "script-src")).toContain(origin)
    }
    for (const origin of STRIPE_FRAME_ORIGINS) {
      expect(cspDirective(policy, "frame-src")).toContain(origin)
    }
    for (const origin of STRIPE_FORM_ACTION_ORIGINS) {
      expect(cspDirective(policy, "form-action")).toContain(origin)
    }
  })

  it("keeps every hardening directive the pervasive policy sets", () => {
    const policy = DONATE_HEADERS["Content-Security-Policy"] as string
    expect(cspDirective(policy, "frame-ancestors")).toEqual(["'none'"])
    expect(cspDirective(policy, "object-src")).toEqual(["'none'"])
    expect(cspDirective(policy, "base-uri")).toEqual(["'self'"])
    expect(cspDirective(policy, "default-src")).toEqual(["'self'"])
  })

  it("re-enables the Payment Request API for Stripe.js and nothing else", () => {
    expect(DONATE_HEADERS["Permissions-Policy"]).toContain('payment=(self "https://js.stripe.com")')
    expect(PERVASIVE_HEADERS["Permissions-Policy"]).toContain("payment=()")
  })

  it("keeps the donation page out of search indexes", () => {
    expect(DONATE_HEADERS["X-Robots-Tag"]).toBe("noindex")
  })
})

describe("Stripe stays off every other route", () => {
  it("has no Stripe origin anywhere in the pervasive policy", () => {
    const policy = PERVASIVE_HEADERS["Content-Security-Policy"] as string
    expect(policy).not.toContain("stripe.com")
    for (const origin of [
      ...STRIPE_SCRIPT_ORIGINS,
      ...STRIPE_FRAME_ORIGINS,
      ...STRIPE_FORM_ACTION_ORIGINS,
    ]) {
      expect(policy).not.toContain(origin)
    }
  })

  it("has no Stripe origin in any block of public/_headers other than /donate/*", () => {
    const blocks = headersFile
      .split("\n")
      .filter((line) => line.trim().length > 0 && !line.trimStart().startsWith("#"))
      .reduce<{ path: string | null; lines: Array<{ path: string; line: string }> }>(
        (state, line) => {
          if (!/^\s/.test(line)) return { path: line.trim(), lines: state.lines }
          if (state.path === null) return state
          return { path: state.path, lines: [...state.lines, { path: state.path, line }] }
        },
        { path: null, lines: [] },
      )
    for (const entry of blocks.lines) {
      if (entry.path === DONATE_HEADERS_PATH) continue
      expect(entry.line).not.toContain("stripe.com")
    }
  })
})
