export interface ChartPoint {
  x: number
  y: number | null
}

export interface BarRect {
  key: string
  x: number
  y: number
  width: number
  height: number
}

export const DEFAULT_BAR_RADIUS = 3

export const DEFAULT_BAR_GAP = 2

export const DEFAULT_RING_THICKNESS = 6

export function clampFraction(value: number): number {
  if (!Number.isFinite(value)) return 0
  return value < 0 ? 0 : value > 1 ? 1 : value
}

export function chartMax(values: readonly (number | null)[], floor = 1): number {
  let max = floor
  for (const value of values) {
    if (value !== null && Number.isFinite(value) && value > max) max = value
  }
  return max
}

function plotY(value: number, max: number, height: number): number {
  if (max <= 0) return height
  return height - (value / max) * height
}

export interface BarInput {
  key: string
  value: number | null
}

export function barRects(
  bars: readonly BarInput[],
  width: number,
  height: number,
  opts: { max?: number; gap?: number } = {},
): BarRect[] {
  if (bars.length === 0 || width <= 0 || height <= 0) return []
  const gap = opts.gap ?? DEFAULT_BAR_GAP
  const max = opts.max ?? chartMax(bars.map((bar) => bar.value))
  const slot = width / bars.length
  const barWidth = Math.max(1, slot - gap)
  return bars.map((bar, index) => {
    const value = bar.value ?? 0
    const barHeight = max <= 0 ? 0 : Math.max(0, (value / max) * height)
    return {
      key: bar.key,
      x: round(index * slot + (slot - barWidth) / 2),
      y: round(height - barHeight),
      width: round(barWidth),
      height: round(barHeight),
    }
  })
}

export function barFraction(value: number | null, max: number): number {
  if (value === null || !Number.isFinite(value) || max <= 0) return 0
  return clampFraction(value / max)
}

export interface LineGeometry {
  line: string
  area: string | null
}

export function lineGeometry(
  points: readonly ChartPoint[],
  width: number,
  height: number,
  opts: { max?: number; xMin?: number; xMax?: number } = {},
): LineGeometry {
  const real = points.filter((point) => point.y !== null && Number.isFinite(point.y))
  if (real.length === 0 || width <= 0 || height <= 0) return { line: "", area: null }
  const xs = points.map((point) => point.x)
  const xMin = opts.xMin ?? Math.min(...xs)
  const xMaxRaw = opts.xMax ?? Math.max(...xs)
  const xMax = xMaxRaw > xMin ? xMaxRaw : xMin + 1
  const max = opts.max ?? chartMax(points.map((point) => point.y))
  const at = (point: ChartPoint): string =>
    `${round(((point.x - xMin) / (xMax - xMin)) * width)},${round(plotY(point.y as number, max, height))}`

  const runs: string[][] = []
  let run: string[] = []
  for (const point of points) {
    if (point.y === null || !Number.isFinite(point.y)) {
      if (run.length > 0) runs.push(run)
      run = []
      continue
    }
    run.push(at(point))
  }
  if (run.length > 0) runs.push(run)

  const line = runs
    .filter((segment) => segment.length > 0)
    .map((segment) => `M ${segment.join(" L ")}`)
    .join(" ")
  const longest = runs.reduce<string[]>((a, b) => (b.length > a.length ? b : a), [])
  if (longest.length < 2) return { line, area: null }
  const firstX = (longest[0] as string).split(",")[0] as string
  const lastX = (longest[longest.length - 1] as string).split(",")[0] as string
  return {
    line,
    area: `M ${firstX},${round(height)} L ${longest.join(" L ")} L ${lastX},${round(height)} Z`,
  }
}

export function xToPixels(x: number, xMin: number, xMax: number, width: number): number {
  if (xMax <= xMin) return 0
  return round(((x - xMin) / (xMax - xMin)) * width)
}

export const AXIS_LABEL_END_FRACTION = 0.85

export type AxisLabelPlacement = { left: number } | { right: 0; textAlign: "right" }

// A label anchored by its left edge near the right end would run past the plot, so the last stretch of
// the axis anchors by the right edge instead.
export function axisLabelPlacement(fraction: number, width: number): AxisLabelPlacement {
  const at = clampFraction(fraction)
  if (at > AXIS_LABEL_END_FRACTION) return { right: 0, textAlign: "right" }
  return { left: round(at * Math.max(0, width)) }
}

export function valueToPixels(value: number, max: number, height: number): number {
  return round(plotY(value, max, height))
}

export function ringRadius(size: number, thickness = DEFAULT_RING_THICKNESS): number {
  return Math.max(0, (size - thickness) / 2)
}

export function progressArcPath(
  value: number,
  size: number,
  thickness = DEFAULT_RING_THICKNESS,
): string {
  const fraction = clampFraction(value)
  if (fraction <= 0 || size <= 0) return ""
  const r = ringRadius(size, thickness)
  const cx = size / 2
  const cy = size / 2
  if (fraction >= 1) {
    return [
      `M ${round(cx)},${round(cy - r)}`,
      `A ${round(r)},${round(r)} 0 1 1 ${round(cx)},${round(cy + r)}`,
      `A ${round(r)},${round(r)} 0 1 1 ${round(cx)},${round(cy - r)}`,
    ].join(" ")
  }
  const angle = fraction * 2 * Math.PI
  const x = cx + r * Math.sin(angle)
  const y = cy - r * Math.cos(angle)
  const large = fraction > 0.5 ? 1 : 0
  return `M ${round(cx)},${round(cy - r)} A ${round(r)},${round(r)} 0 ${large} 1 ${round(x)},${round(y)}`
}

function round(value: number): number {
  const rounded = Math.round(value * 100) / 100
  return Number.isFinite(rounded) ? rounded : 0
}
