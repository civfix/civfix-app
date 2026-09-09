import { describe, expect, it } from "vitest"
import { EventPageBlockSchema, SafeHttpsLinkSchema } from "../src/index.js"

const HOSTILE = [
  "javascript:alert(1)",
  "JavaScript:alert(1)",
  "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
  "vbscript:msgbox(1)",
  "http://civfix.org/donate",
  "//evil.example/donate",
  "https://civfix.org@evil.example/donate",
  "https://user:pass@evil.example/donate",
  "https://1.2.3.4/donate",
  "https://192.168.0.1/donate",
  "https://[::1]/donate",
  "https://xn--80ak6aa92e.com/donate",
  "https://аpple.com/donate",
  "https://civfix .org/donate",
  "not a url",
  "",
]

function donate(url: string): unknown {
  return { id: "b1", kind: "donate", url }
}

function sponsors(url: string): unknown {
  return { id: "b2", kind: "sponsors", entries: [{ name: "Acme", url }] }
}

function contact(replyTo: string): unknown {
  return { id: "b3", kind: "contact", replyTo }
}

describe("page-block link fields are validated at the boundary", () => {
  it("accepts an ordinary https link on donate and sponsors", () => {
    expect(EventPageBlockSchema.parse(donate("https://give.example.org/creek"))).toMatchObject({
      url: "https://give.example.org/creek",
    })
    expect(EventPageBlockSchema.parse(sponsors("https://acme.example/"))).toMatchObject({
      entries: [{ url: "https://acme.example/" }],
    })
    expect(EventPageBlockSchema.parse(donate("  https://give.example.org/creek  "))).toMatchObject({
      url: "https://give.example.org/creek",
    })
  })

  it("rejects every hostile donate url", () => {
    for (const url of HOSTILE) {
      expect(EventPageBlockSchema.safeParse(donate(url)).success, url).toBe(false)
    }
  })

  it("rejects every hostile sponsor url", () => {
    for (const url of HOSTILE) {
      expect(EventPageBlockSchema.safeParse(sponsors(url)).success, url).toBe(false)
    }
  })

  it("keeps donate and sponsor urls optional and nullable", () => {
    expect(EventPageBlockSchema.safeParse({ id: "b1", kind: "donate" }).success).toBe(true)
    expect(EventPageBlockSchema.safeParse(donate(null as unknown as string)).success).toBe(true)
    expect(
      EventPageBlockSchema.safeParse({ id: "b2", kind: "sponsors", entries: [{ name: "Acme" }] })
        .success,
    ).toBe(true)
  })

  it("bounds the link length", () => {
    expect(SafeHttpsLinkSchema.safeParse(`https://civfix.org/${"a".repeat(500)}`).success).toBe(
      false,
    )
    expect(SafeHttpsLinkSchema.safeParse("https://civfix.org/donate").success).toBe(true)
  })

  it("accepts only an email address on contact.replyTo", () => {
    expect(EventPageBlockSchema.parse(contact("  Hosts@Example.ORG "))).toMatchObject({
      replyTo: "hosts@example.org",
    })
    for (const value of [
      "javascript:alert(1)",
      "https://evil.example/x",
      "mailto:hosts@example.org",
      "hosts@",
      "@example.org",
      "hosts",
      `${"a".repeat(250)}@b.org`,
    ]) {
      expect(EventPageBlockSchema.safeParse(contact(value)).success, value).toBe(false)
    }
    expect(EventPageBlockSchema.safeParse({ id: "b3", kind: "contact" }).success).toBe(true)
  })
})
