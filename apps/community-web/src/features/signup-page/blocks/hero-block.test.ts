import { describe, expect, it } from "vitest"

import { formatEventWhen } from "./hero-block"

const STARTS_AT = "2026-09-12T17:00:00.000Z"

describe("signup hero date", () => {
  it("formats in the visitor's active locale, in the event's own zone", () => {
    const when = formatEventWhen(STARTS_AT, "America/New_York", "de")
    expect(when).toContain("Samstag")
    expect(when).toContain("13:00")
  })

  it("shows an event without a usable zone in the visitor's zone, labelled", () => {
    const visitor = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(STARTS_AT))
    expect(formatEventWhen(STARTS_AT, null, "en-US")).toBe(visitor)
    expect(formatEventWhen(STARTS_AT, "Mars/Olympus", "en-US")).toBe(visitor)
  })

  it("leaves out an unreadable start", () => {
    expect(formatEventWhen("nonsense", null, "en-US")).toBe("")
  })
})
