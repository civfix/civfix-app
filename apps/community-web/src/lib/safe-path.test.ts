import { describe, it, expect } from "vitest"

import { isSafeInternalPath } from "@/lib/safe-path"

/**
 * isSafeInternalPath gates server-provided navigation targets (NotificationDTO.link). It must accept
 * only same-origin absolute in-app paths and reject schemes, external/protocol-relative URLs, and
 * whitespace-padded values that could smuggle a dangerous target past naive checks.
 */
describe("isSafeInternalPath", () => {
  it("accepts absolute in-app paths", () => {
    expect(isSafeInternalPath("/")).toBe(true)
    expect(isSafeInternalPath("/pin/abc")).toBe(true)
    expect(isSafeInternalPath("/people/123?tab=cleanups")).toBe(true)
    expect(isSafeInternalPath("/notifications#top")).toBe(true)
  })

  it("rejects empty, null, and undefined", () => {
    expect(isSafeInternalPath("")).toBe(false)
    expect(isSafeInternalPath(null)).toBe(false)
    expect(isSafeInternalPath(undefined)).toBe(false)
  })

  it("rejects protocol-relative and backslash-host URLs", () => {
    expect(isSafeInternalPath("//evil.com")).toBe(false)
    expect(isSafeInternalPath("//evil.com/path")).toBe(false)
    expect(isSafeInternalPath("/\\evil.com")).toBe(false)
  })

  it("rejects absolute URLs with a scheme", () => {
    expect(isSafeInternalPath("https://evil.com")).toBe(false)
    expect(isSafeInternalPath("http://evil.com/x")).toBe(false)
  })

  it("rejects javascript: and data: schemes", () => {
    expect(isSafeInternalPath("javascript:alert(1)")).toBe(false)
    expect(isSafeInternalPath("data:text/html,<script>1</script>")).toBe(false)
  })

  it("rejects relative paths that do not start with a slash", () => {
    expect(isSafeInternalPath("pin/abc")).toBe(false)
    expect(isSafeInternalPath("./x")).toBe(false)
    expect(isSafeInternalPath("../x")).toBe(false)
  })

  it("rejects whitespace-padded values", () => {
    expect(isSafeInternalPath("  /pin/abc")).toBe(false)
    expect(isSafeInternalPath("/pin/abc ")).toBe(false)
    expect(isSafeInternalPath("\t/x")).toBe(false)
    // A padded javascript: must never slip through.
    expect(isSafeInternalPath("  javascript:alert(1)")).toBe(false)
  })
})
