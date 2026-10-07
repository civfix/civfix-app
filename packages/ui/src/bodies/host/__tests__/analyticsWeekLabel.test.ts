import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { surfaceSource } from "../../../__tests__/sourceGuards"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")

const card = read("../dashboard/AnalyticsCarouselCard.tsx")
const page = surfaceSource("eventAnalytics")
const hook = read("../useWeekLabel.ts")

describe("both analytics surfaces share the one formatter", () => {
  it("builds the weekly axis labels from weekDayLabel, not a local Intl formatter", () => {
    expect(hook).toContain('import { weekDayLabel } from "@civfix/shared/host"')
    expect(hook).toContain("weekDayLabel(locale)")
    expect(hook).not.toContain("new Intl.DateTimeFormat")
    for (const src of [card, page]) {
      expect(src).toContain('import { useWeekLabel } from "../useWeekLabel"')
      expect(src).toContain("useWeekLabel()")
      expect(src).not.toContain("new Intl.DateTimeFormat")
    }
  })
})
