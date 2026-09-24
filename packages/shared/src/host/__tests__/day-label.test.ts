import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { weekDayLabel } from "../day-label.js"

describe("weekDayLabel", () => {
  const zone = process.env.TZ

  beforeAll(() => {
    process.env.TZ = "America/Los_Angeles"
  })

  afterAll(() => {
    if (zone === undefined) delete process.env.TZ
    else process.env.TZ = zone
  })

  it("names the calendar day the server bucketed, for a viewer west of UTC", () => {
    expect(weekDayLabel("en-US")("2026-09-14")).toBe("Sep 14")
  })

  it("keeps the same day at a month edge", () => {
    expect(weekDayLabel("en-US")("2026-10-01")).toBe("Oct 1")
  })

  it("falls back to the runtime locale rather than throwing on a malformed tag", () => {
    expect(weekDayLabel("not a locale!!")("2026-09-14")).toMatch(/14/)
  })

  it("shows an unreadable day key as it came instead of throwing", () => {
    expect(weekDayLabel("en-US")("not-a-day")).toBe("not-a-day")
  })
})
