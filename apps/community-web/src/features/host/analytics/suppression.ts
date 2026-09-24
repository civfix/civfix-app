import type { BreakdownRow, Panel, SeriesPoint } from "@civfix/shared"

export function visibleRows(panel: Panel): BreakdownRow[] {
  if (panel.panelSuppressed) return []
  return panel.rows.filter((row) => row.value !== null)
}

export function panelIsBlank(panel: Panel): boolean {
  return panel.panelSuppressed || visibleRows(panel).length === 0
}

export function seriesIsChartable(points: readonly SeriesPoint[]): boolean {
  return points.filter((point) => point.value !== null).length >= 2
}

export function seriesValuesForChart(points: readonly SeriesPoint[]): (number | null)[] {
  return points.map((point) => point.value)
}

export function seriesHasSuppressedPoints(points: readonly SeriesPoint[]): boolean {
  return points.some((point) => point.value === null || point.suppressed)
}
