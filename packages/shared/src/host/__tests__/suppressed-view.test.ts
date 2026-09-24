import { describe, expect, it } from "vitest"
import type { Panel, SeriesPoint } from "../../schemas/host/analytics.js"
import {
  panelIsBlank,
  seriesHasSuppressedPoints,
  seriesIsChartable,
  seriesValuesForChart,
  visibleRows,
  visibleValue,
} from "../suppressed-view.js"

function point(value: number | null, suppressed = value === null): SeriesPoint {
  return { day: "2026-03-01", value, suppressed }
}

describe("analytics suppression", () => {
  it("drops every row of a wholly suppressed panel", () => {
    const panel: Panel = {
      panelSuppressed: true,
      rows: [{ key: "a", label: "A", value: 9, suppressed: false }],
    }
    expect(visibleRows(panel)).toEqual([])
    expect(panelIsBlank(panel)).toBe(true)
  })

  it("drops only the suppressed rows of a live panel", () => {
    const panel: Panel = {
      panelSuppressed: false,
      rows: [
        { key: "a", label: "A", value: 9, suppressed: false },
        { key: "b", label: "B", value: null, suppressed: true },
        { key: "c", label: "C", value: 0, suppressed: false },
      ],
    }
    expect(visibleRows(panel).map((row) => row.key)).toEqual(["a", "c"])
    expect(panelIsBlank(panel)).toBe(false)
  })

  it("treats a panel whose every row is suppressed as blank", () => {
    expect(
      panelIsBlank({
        panelSuppressed: false,
        rows: [{ key: "a", label: "A", value: null, suppressed: true }],
      }),
    ).toBe(true)
  })

  it("charts a series only once two real points exist", () => {
    expect(seriesIsChartable([])).toBe(false)
    expect(seriesIsChartable([point(3)])).toBe(false)
    expect(seriesIsChartable([point(3), point(null)])).toBe(false)
    expect(seriesIsChartable([point(3), point(0)])).toBe(true)
  })

  it("carries a suppressed point through to the chart as null, NEVER as a fabricated zero", () => {
    const series = [point(3), point(null), point(1)]
    expect(seriesValuesForChart(series)).toEqual([3, null, 1])
    expect(seriesValuesForChart(series)).not.toContain(0)
    expect(seriesHasSuppressedPoints(series)).toBe(true)
    expect(seriesHasSuppressedPoints([point(3), point(1)])).toBe(false)
  })

  it("keeps a real zero distinguishable from a suppressed point", () => {
    expect(seriesValuesForChart([point(0, false), point(null)])).toEqual([0, null])
  })

  it("never shows a number the server flagged as suppressed, even when one came with it", () => {
    expect(visibleValue({ value: 4, suppressed: true })).toBeNull()
    expect(visibleValue({ value: 4, suppressed: false })).toBe(4)
    expect(seriesValuesForChart([point(3), point(4, true)])).toEqual([3, null])
    expect(seriesIsChartable([point(3), point(4, true)])).toBe(false)
    expect(seriesHasSuppressedPoints([point(3), point(4, true)])).toBe(true)
    const panel: Panel = {
      panelSuppressed: false,
      rows: [{ key: "a", label: "A", value: 4, suppressed: true }],
    }
    expect(visibleRows(panel)).toEqual([])
    expect(panelIsBlank(panel)).toBe(true)
  })
})
