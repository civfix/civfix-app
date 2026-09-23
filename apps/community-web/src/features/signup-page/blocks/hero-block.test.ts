import { describe, expect, it } from "vitest"

import { formatEventWhen } from "./hero-block"

describe("signup hero date", () => {
  it("formats in the visitor's active locale, not always en-US", () => {
    const when = formatEventWhen("2026-09-12T17:00:00.000Z", "America/New_York", "de")
    expect(when).toContain("Samstag")
    expect(when).not.toContain("Saturday")
  })

  it("keeps the event's own time zone", () => {
    expect(formatEventWhen("2026-09-12T17:00:00.000Z", "America/New_York", "en")).toContain("1:00")
  })

  it("survives an unknown zone and an invalid date", () => {
    expect(formatEventWhen("2026-09-12T17:00:00.000Z", "Mars/Olympus", "en")).toContain("September")
    expect(formatEventWhen("nonsense", null, "en")).toBeNull()
  })
})
