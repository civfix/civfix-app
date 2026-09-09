import { describe, expect, it } from "vitest"
import { graphemeLength, segmentGraphemes, truncateGraphemes } from "../graphemes.js"
import {
  BROADCAST_VARS,
  BroadcastLinkError,
  INAPP_BODY_MAX,
  PUSH_BODY_MAX,
  PUSH_TITLE_MAX,
  SMS_BODY_MAX,
  SMS_OPT_OUT_SUFFIX,
  assertSafeBroadcastLinks,
  inAppBodyFrom,
  inspectBroadcastLinks,
  pushBodyFrom,
  pushTitleFrom,
  renderBroadcastVars,
  smsBodyFrom,
} from "../render.js"

describe("renderBroadcastVars", () => {
  it("substitutes only the allowlisted vars", () => {
    expect(BROADCAST_VARS).toEqual([
      "first_name",
      "event_title",
      "event_when",
      "event_where",
      "ticket_type",
      "manage_link",
    ])
    const out = renderBroadcastVars("Hi {first_name}, {event_title} is {event_when} at {event_where}.", {
      first_name: "Ada",
      event_title: "Creek Cleanup",
      event_when: "Saturday 9am",
      event_where: "Elysian Park",
    })
    expect(out).toBe("Hi Ada, Creek Cleanup is Saturday 9am at Elysian Park.")
  })

  it("leaves an unknown var literal", () => {
    expect(renderBroadcastVars("{nope} {first_name} {DROP TABLE}", { first_name: "Ada" })).toBe(
      "{nope} Ada {DROP TABLE}",
    )
  })

  it("empties a known var with no value instead of leaking the token", () => {
    expect(renderBroadcastVars("Hi {first_name}!", {})).toBe("Hi !")
  })

  it("never re-scans a substituted value", () => {
    expect(renderBroadcastVars("{first_name}", { first_name: "{event_title}", event_title: "boom" })).toBe(
      "{event_title}",
    )
  })
})

describe("grapheme-safe truncation", () => {
  it("keeps emoji clusters intact", () => {
    const flag = "🇺🇸"
    const family = "👩‍👩‍👧"
    expect(segmentGraphemes(`${flag}${family}`)).toEqual([flag, family])
    expect(graphemeLength("é")).toBe(1)
    expect(truncateGraphemes(`${flag}${family}x`, 2)).toBe(`${flag}…`)
    expect([...truncateGraphemes(`${family}${family}`, 2)].length).toBeGreaterThan(0)
  })

  it("returns the input untouched when it already fits", () => {
    expect(truncateGraphemes("short", 40)).toBe("short")
  })

  it("respects each channel budget", () => {
    const long = "x".repeat(500)
    expect(graphemeLength(pushTitleFrom(long))).toBe(PUSH_TITLE_MAX)
    expect(graphemeLength(pushBodyFrom(long))).toBe(PUSH_BODY_MAX)
    expect(graphemeLength(inAppBodyFrom(long))).toBe(INAPP_BODY_MAX)
    expect(pushTitleFrom(long).endsWith("…")).toBe(true)
  })

  it("collapses whitespace before measuring", () => {
    expect(pushTitleFrom("  a \n\n b\t c ")).toBe("a b c")
  })
})

describe("smsBodyFrom", () => {
  it("always leaves room for the opt-out line", () => {
    const body = smsBodyFrom("y".repeat(400))
    expect(body.endsWith(SMS_OPT_OUT_SUFFIX)).toBe(true)
    expect(graphemeLength(body)).toBeLessThanOrEqual(SMS_BODY_MAX)
  })

  it("keeps a short body verbatim", () => {
    expect(smsBodyFrom("Gates open at 9.")).toBe(`Gates open at 9. ${SMS_OPT_OUT_SUFFIX}`)
  })

  it("can be built without the opt-out for a pre-suffixed pipeline", () => {
    expect(smsBodyFrom("hello", { includeOptOut: false })).toBe("hello")
  })
})

describe("assertSafeBroadcastLinks", () => {
  it("accepts plain https links", () => {
    expect(() =>
      assertSafeBroadcastLinks("See https://civfix.org/e/creek and https://maps.example.org/x?a=1"),
    ).not.toThrow()
  })

  it("rejects non-https schemes", () => {
    expect(inspectBroadcastLinks("http://civfix.org")[0]?.kind).toBe("insecure_scheme")
    expect(inspectBroadcastLinks("javascript:alert(1)")[0]?.kind).toBe("insecure_scheme")
    expect(inspectBroadcastLinks("data:text/html;base64,PHNjcmlwdD4=")[0]?.kind).toBe("insecure_scheme")
  })

  it("rejects scheme-relative links", () => {
    expect(inspectBroadcastLinks("go to //evil.example/x")[0]?.kind).toBe("scheme_relative")
  })

  it("rejects userinfo, IP literals and punycode hosts", () => {
    expect(
      inspectBroadcastLinks("https://civfix.org@evil.example/x").some((i) => i.kind === "userinfo"),
    ).toBe(true)
    expect(inspectBroadcastLinks("https://192.168.0.1/x").some((i) => i.kind === "ip_literal")).toBe(true)
    expect(inspectBroadcastLinks("https://[::1]/x").some((i) => i.kind === "ip_literal")).toBe(true)
    expect(inspectBroadcastLinks("https://xn--80ak6aa92e.com/x").some((i) => i.kind === "punycode")).toBe(
      true,
    )
    expect(
      inspectBroadcastLinks("https://аpple.com/x").some((i) => i.kind === "non_ascii_host"),
    ).toBe(true)
  })

  it("caps the link count", () => {
    const many = Array.from({ length: 6 }, (_, i) => `https://civfix.org/${i}`).join(" ")
    const issues = inspectBroadcastLinks(many)
    expect(issues[0]).toEqual({ kind: "too_many", count: 6, max: 5 })
    expect(inspectBroadcastLinks(many, { maxLinks: 10 })).toHaveLength(0)
  })

  it("enforces an optional host allowlist including subdomains", () => {
    const options = { allowedHosts: ["civfix.org"] }
    expect(inspectBroadcastLinks("https://maps.civfix.org/x", options)).toHaveLength(0)
    expect(inspectBroadcastLinks("https://civfix.org.evil.example/x", options)[0]?.kind).toBe(
      "host_not_allowed",
    )
  })

  it("throws a BroadcastLinkError carrying every issue", () => {
    try {
      assertSafeBroadcastLinks("http://a.example javascript:x")
      expect.unreachable("expected a BroadcastLinkError")
    } catch (error) {
      expect(error).toBeInstanceOf(BroadcastLinkError)
      expect((error as BroadcastLinkError).issues.length).toBeGreaterThanOrEqual(2)
    }
  })
})
