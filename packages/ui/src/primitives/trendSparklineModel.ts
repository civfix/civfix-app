import type { SeriesPoint } from "@civfix/shared"

export const SPARK_BAR_MAX_WIDTH = 24
export const SPARK_BAR_GAP = 2
export const SPARK_BAR_MIN_HEIGHT = 2
export const SPARK_BAR_RADIUS = 4
export const SPARK_LINE_WIDTH = 2
export const SPARK_END_DOT_RADIUS = 4

export interface SparkPoint {
  key: string
  value: number | null
}

export interface SparkBar {
  key: string
  x: number
  y: number
  width: number
  height: number
  path: string
  muted: boolean
}

export interface SparkVertex {
  key: string
  x: number
  y: number
}

export interface SparklineGeometry {
  bars: readonly SparkBar[]
  vertices: readonly SparkVertex[]
  polyline: string
  endIndex: number
  end: SparkVertex | null
}

export function sparklinePoints(series: readonly SeriesPoint[]): SparkPoint[] {
  return series.map((point) => ({
    key: point.day,
    value: point.suppressed ? null : point.value,
  }))
}

export function suppressedSparkKeys(series: readonly SeriesPoint[]): ReadonlySet<string> {
  return new Set(series.filter((point) => point.suppressed).map((point) => point.day))
}

function sparkBarHeight(known: boolean, ratio: number, height: number): number {
  if (!known) return SPARK_BAR_MIN_HEIGHT
  return ratio > 0 ? Math.max(SPARK_BAR_MIN_HEIGHT, ratio * height) : 0
}

function peakOf(points: readonly SparkPoint[]): number {
  return points.reduce((top, point) => Math.max(top, point.value ?? 0), 0)
}

function roundedTopBarPath(x: number, y: number, width: number, height: number): string {
  const radius = Math.min(SPARK_BAR_RADIUS, width / 2, height)
  const right = x + width
  const bottom = y + height
  if (radius <= 0) return `M${x} ${y}H${right}V${bottom}H${x}Z`
  return [
    `M${x} ${bottom}`,
    `V${y + radius}`,
    `Q${x} ${y} ${x + radius} ${y}`,
    `H${right - radius}`,
    `Q${right} ${y} ${right} ${y + radius}`,
    `V${bottom}`,
    "Z",
  ].join("")
}

export function sparklineGeometry(
  points: readonly SparkPoint[],
  width: number,
  height: number,
): SparklineGeometry {
  if (points.length === 0 || width <= 0 || height <= 0) {
    return { bars: [], vertices: [], polyline: "", endIndex: -1, end: null }
  }
  const peak = peakOf(points)
  const slot = width / points.length
  const barWidth = Math.max(1, Math.min(SPARK_BAR_MAX_WIDTH, slot - SPARK_BAR_GAP))
  const bars: SparkBar[] = []
  const vertices: SparkVertex[] = []
  let endIndex = -1

  points.forEach((point, index) => {
    const centre = slot * index + slot / 2
    const known = point.value !== null
    const ratio = known && peak > 0 ? (point.value ?? 0) / peak : 0
    const barHeight = sparkBarHeight(known, ratio, height)
    const x = centre - barWidth / 2
    const y = height - barHeight
    bars.push({
      key: point.key,
      x,
      y,
      width: barWidth,
      height: barHeight,
      path: barHeight > 0 ? roundedTopBarPath(x, y, barWidth, barHeight) : "",
      muted: !known,
    })
    if (known) {
      endIndex = index
      vertices.push({ key: point.key, x: centre, y: height - ratio * height })
    }
  })

  const end = vertices.length > 0 ? (vertices[vertices.length - 1] ?? null) : null
  return {
    bars,
    vertices,
    polyline: vertices.map((vertex) => `${vertex.x},${vertex.y}`).join(" "),
    endIndex,
    end,
  }
}
