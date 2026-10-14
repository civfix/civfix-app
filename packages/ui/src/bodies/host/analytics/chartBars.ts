import type { BreakdownRow, SeriesPoint } from "@civfix/shared"
import { visibleValue } from "@civfix/shared/host"
import type { ChartBar } from "../../../charts"
import { EMPTY_VALUE } from "../../../i18n/emptyValue"

export function seriesBars(points: readonly SeriesPoint[], color: string): ChartBar[] {
  return points.map((point) => ({
    key: point.day,
    value: visibleValue(point),
    color,
  }))
}

export function breakdownBars(
  rows: readonly BreakdownRow[],
  color: string,
  label?: (row: BreakdownRow) => string,
): ChartBar[] {
  return rows.map((row) => ({
    key: row.key,
    label: label ? label(row) : row.label,
    value: visibleValue(row),
    color,
    valueLabel: row.suppressed ? EMPTY_VALUE : String(row.value ?? 0),
  }))
}
