import type { Panel, SeriesPoint, SuppressedRate } from "@civfix/shared"
import { describe, expect, it } from "vitest"

import {
  DEFAULT_SUPPRESSION_K,
  isSuppressedValue,
  panelIsBlank,
  rateIsShowable,
  seriesHasSuppressedPoints,
  seriesIsChartable,
  seriesValuesForChart,
  visibleRows,
} from "./suppression"

function point(value: number | null, suppressed = value === null): SeriesPoint {
  return { day: "2026-03-01", value, suppressed }
}

function rate(over: Partial<SuppressedRate> = {}): SuppressedRate {
  return { value: 0.5, numerator: 5, denominator: 10, suppressed: false, ...over }
}

describe("analytics suppression", () => {
  it("matches the contract's k", () => {
    expect(DEFAULT_SUPPRESSION_K).toBe(5)
  })

  it("treats null as suppressed and zero as a real, showable value", () => {
    expect(isSuppressedValue(null)).toBe(true)
    expect(isSuppressedValue(0)).toBe(false)
    expect(isSuppressedValue(7)).toBe(false)
  })

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

  it("shows a rate only when it is neither null nor flagged", () => {
    expect(rateIsShowable(rate())).toBe(true)
    expect(rateIsShowable(rate({ value: null, numerator: null, denominator: null, suppressed: true }))).toBe(false)
    expect(rateIsShowable(rate({ suppressed: true }))).toBe(false)
    expect(rateIsShowable(rate({ value: 0 }))).toBe(true)
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
})
