import { describe, expect, it } from "vitest"

import { MAY_NOT_RECEIVE_FALLBACK_URL, safeMayNotReceiveUrl } from "./disclosures-block"

describe("safeMayNotReceiveUrl", () => {
  it("keeps the server's https url", () => {
    expect(safeMayNotReceiveUrl("https://civfix.org/legal/donations#may-not-receive")).toBe(
      "https://civfix.org/legal/donations#may-not-receive",
    )
  })

  it("keeps a same-origin path", () => {
    expect(safeMayNotReceiveUrl("/legal/donations#may-not-receive")).toBe(
      "/legal/donations#may-not-receive",
    )
  })

  it("falls back rather than rendering a dangerous scheme", () => {
    for (const value of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      " javascript:alert(1)",
    ]) {
      expect(safeMayNotReceiveUrl(value)).toBe(MAY_NOT_RECEIVE_FALLBACK_URL)
    }
  })

  it("falls back on a protocol-relative path", () => {
    expect(safeMayNotReceiveUrl("//evil.example/x")).toBe(MAY_NOT_RECEIVE_FALLBACK_URL)
  })

  it("falls back on an empty or missing value", () => {
    expect(safeMayNotReceiveUrl("")).toBe(MAY_NOT_RECEIVE_FALLBACK_URL)
    expect(safeMayNotReceiveUrl(null)).toBe(MAY_NOT_RECEIVE_FALLBACK_URL)
    expect(safeMayNotReceiveUrl(undefined)).toBe(MAY_NOT_RECEIVE_FALLBACK_URL)
  })
})
