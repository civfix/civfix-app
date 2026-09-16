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

/**
 * The top of the y axis. Charts here always start at zero - a truncated axis reads as a bigger swing
 * than the numbers justify, and these are a host's own totals, not a trading chart.
 */
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

/**
 * Contiguous runs of real numbers, as polyline point strings. A null is a SUPPRESSED point, not a
 * zero, so the line breaks there rather than diving to the axis and inventing a drop.
 */
export function sparklineSegments(
  values: readonly (number | null)[],
  width: number,
  height: number,
  max = chartMax(values),
): string[] {
  if (values.length === 0 || width <= 0 || height <= 0) return []
  const step = values.length === 1 ? 0 : width / (values.length - 1)
  const segments: string[] = []
  let run: string[] = []
  values.forEach((value, index) => {
    if (value === null || !Number.isFinite(value)) {
      if (run.length > 0) segments.push(run.join(" "))
      run = []
      return
    }
    const x = values.length === 1 ? width / 2 : index * step
    run.push(`${round(x)},${round(plotY(value, max, height))}`)
  })
  if (run.length > 0) segments.push(run.join(" "))
  return segments.filter((segment) => segment.includes(" "))
}

/** The filled area under the longest contiguous run, or null when there is nothing to fill. */
export function sparklineAreaPath(
  values: readonly (number | null)[],
  width: number,
  height: number,
  max = chartMax(values),
): string | null {
  const segments = sparklineSegments(values, width, height, max)
  if (segments.length === 0) return null
  const longest = segments.reduce((a, b) => (b.length > a.length ? b : a))
  const points = longest.split(" ")
  const first = points[0] as string
  const last = points[points.length - 1] as string
  const firstX = first.split(",")[0] as string
  const lastX = last.split(",")[0] as string
  return `M ${firstX},${round(height)} L ${points.join(" L ")} L ${lastX},${round(height)} Z`
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

/** 0..1 of the bar track, for the plain-View horizontal bars the breakdown lists draw. */
export function barFraction(value: number | null, max: number): number {
  if (value === null || !Number.isFinite(value) || max <= 0) return 0
  return clampFraction(value / max)
}

export interface LineGeometry {
  line: string
  area: string | null
}

/**
 * An x-positioned series (a lifecycle runs on real timestamps, not on evenly spaced indices), scaled
 * into the box. A null y breaks the line exactly as it does in a sparkline.
 */
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

export function valueToPixels(value: number, max: number, height: number): number {
  return round(plotY(value, max, height))
}

/**
 * The swept arc of a progress ring, drawn clockwise from twelve o'clock. A full ring is TWO arcs,
 * because a single SVG arc whose end meets its start renders as nothing.
 */
export function progressArcPath(
  value: number,
  size: number,
  thickness = DEFAULT_RING_THICKNESS,
): string {
  const fraction = clampFraction(value)
  if (fraction <= 0 || size <= 0) return ""
  const r = (size - thickness) / 2
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
