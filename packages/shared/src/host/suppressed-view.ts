import type { BreakdownRow, Panel, SeriesPoint } from "../schemas/host/analytics.js"

const MIN_CHARTABLE_POINTS = 2

interface Suppressible {
  value: number | null
  suppressed: boolean
}

// A suppressed entry never shows its number, even when one came over the wire: charting it would undo
// the k-anonymity floor. A real zero stays a zero.
export function visibleValue(entry: Suppressible): number | null {
  return entry.suppressed ? null : entry.value
}

export function visibleRows(panel: Panel): BreakdownRow[] {
  if (panel.panelSuppressed) return []
  return panel.rows.filter((row) => visibleValue(row) !== null)
}

export function panelIsBlank(panel: Panel): boolean {
  return visibleRows(panel).length === 0
}

export function seriesValuesForChart(points: readonly SeriesPoint[]): (number | null)[] {
  return points.map(visibleValue)
}

export function seriesIsChartable(points: readonly SeriesPoint[]): boolean {
  return seriesValuesForChart(points).filter((value) => value !== null).length >= MIN_CHARTABLE_POINTS
}

export function seriesHasSuppressedPoints(points: readonly SeriesPoint[]): boolean {
  return points.some((point) => point.value === null || point.suppressed)
}
