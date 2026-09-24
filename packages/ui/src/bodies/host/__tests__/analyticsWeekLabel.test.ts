import { readFileSync } from "node:fs"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { weekDayLabel } from "../analyticsModel"
import { analyticsPageSource } from "./analyticsPageSource"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")

const card = read("../dashboard/AnalyticsCarouselCard.tsx")
const page = analyticsPageSource()
const hook = read("../useWeekLabel.ts")

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
})

describe("both analytics surfaces share the one formatter", () => {
  it("builds the weekly axis labels from weekDayLabel, not a local Intl formatter", () => {
    expect(hook).toContain("weekDayLabel(locale)")
    expect(hook).not.toContain("new Intl.DateTimeFormat")
    for (const src of [card, page]) {
      expect(src).toContain('import { useWeekLabel } from "../useWeekLabel"')
      expect(src).toContain("useWeekLabel()")
      expect(src).not.toContain("new Intl.DateTimeFormat")
    }
  })
})
