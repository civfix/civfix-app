import { describe, expect, it } from "vitest"

import { contactMailtoAddress } from "./contact-block"

describe("contactMailtoAddress", () => {
  it("accepts an ordinary address", () => {
    expect(contactMailtoAddress("hosts@example.org")).toBe("hosts@example.org")
    expect(contactMailtoAddress("  a.b+tag@sub.example.co.uk  ")).toBe("a.b+tag@sub.example.co.uk")
  })

  it("refuses a header-injection payload the contract's plain string would allow", () => {
    for (const value of [
      "a@b.org?bcc=victim@x.org",
      "a@b.org&subject=hi",
      "a@b.org%0abcc:victim@x.org",
      "a@b.org, c@d.org",
      "a@b.org\nbcc: c@d.org",
      '"a b"@c.org',
    ]) {
      expect(contactMailtoAddress(value)).toBeNull()
    }
  })

  it("refuses a non-mailto scheme smuggled into the field", () => {
    expect(contactMailtoAddress("javascript:alert(1)")).toBeNull()
    expect(contactMailtoAddress("https://evil.example/x")).toBeNull()
  })

  it("refuses empty, missing and over-long values", () => {
    expect(contactMailtoAddress("")).toBeNull()
    expect(contactMailtoAddress("   ")).toBeNull()
    expect(contactMailtoAddress(null)).toBeNull()
    expect(contactMailtoAddress(undefined)).toBeNull()
    expect(contactMailtoAddress(`${"a".repeat(250)}@b.org`)).toBeNull()
  })

  it("refuses something that is not an address at all", () => {
    expect(contactMailtoAddress("hosts")).toBeNull()
    expect(contactMailtoAddress("hosts@")).toBeNull()
    expect(contactMailtoAddress("@example.org")).toBeNull()
    expect(contactMailtoAddress("hosts@example")).toBeNull()
  })
})
