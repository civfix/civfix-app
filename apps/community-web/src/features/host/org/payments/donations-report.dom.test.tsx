import { describe, expect, it, vi } from "vitest"

vi.mock("@civfix/ui/i18n", async () => {
  const { makeI18nMock } = await import("@/components/console/__testing__/i18n-mock")
  return makeI18nMock()
})

import { localDayIso } from "./donations-report"

describe("donations report date filters", () => {
  it("anchors a date-only filter to the viewer's own midnight, not UTC's", () => {
    const iso = localDayIso("2026-09-12", 0, 0, 0, 0)
    expect(iso).toBeDefined()
    const at = new Date(iso as string)
    expect([at.getFullYear(), at.getMonth() + 1, at.getDate()]).toEqual([2026, 9, 12])
    expect([at.getHours(), at.getMinutes(), at.getSeconds()]).toEqual([0, 0, 0])
  })

  it("closes the range on the last local millisecond of the chosen day", () => {
    const at = new Date(localDayIso("2026-09-12", 23, 59, 59, 999) as string)
    expect(at.getDate()).toBe(12)
    expect([at.getHours(), at.getMinutes(), at.getSeconds(), at.getMilliseconds()]).toEqual([
      23, 59, 59, 999,
    ])
  })

  it("sends no bound at all for a blank or malformed filter", () => {
    expect(localDayIso("", 0, 0, 0, 0)).toBeUndefined()
    expect(localDayIso("2026-9-12", 0, 0, 0, 0)).toBeUndefined()
    expect(localDayIso("not-a-day", 0, 0, 0, 0)).toBeUndefined()
  })
})
