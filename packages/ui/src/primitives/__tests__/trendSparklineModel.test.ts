import { describe, expect, it } from "vitest"
import {
  sparklineGeometry,
  sparklinePoints,
  suppressedSparkKeys,
  SPARK_BAR_GAP,
  SPARK_BAR_MAX_WIDTH,
  SPARK_BAR_MIN_HEIGHT,
  type SparkPoint,
} from "../trendSparklineModel"

const series = [
  { day: "2026-03-01", value: 4, suppressed: false },
  { day: "2026-03-02", value: null, suppressed: false },
  { day: "2026-03-03", value: 7, suppressed: true },
]

describe("sparklinePoints", () => {
  it("maps the wire series onto keyed points and blanks a suppressed day", () => {
    expect(sparklinePoints(series)).toEqual([
      { key: "2026-03-01", value: 4 },
      { key: "2026-03-02", value: null },
      { key: "2026-03-03", value: null },
    ])
  })

  it("names the suppressed days so the caller can mute exactly those bars", () => {
    expect([...suppressedSparkKeys(series)]).toEqual(["2026-03-03"])
  })
})

describe("sparklineGeometry", () => {
  const points: SparkPoint[] = [
    { key: "a", value: 0 },
    { key: "b", value: 5 },
    { key: "c", value: 10 },
  ]

  it("renders nothing before the box is measured", () => {
    expect(sparklineGeometry(points, 0, 56)).toEqual({
      bars: [],
      vertices: [],
      polyline: "",
      endIndex: -1,
      end: null,
    })
    expect(sparklineGeometry([], 300, 56).bars).toEqual([])
  })

  it("leaves a 2px surface gap between adjacent bars and caps the bar width", () => {
    const wide = sparklineGeometry(points, 300, 56)
    const [first, second] = wide.bars
    expect(first?.width).toBe(SPARK_BAR_MAX_WIDTH)
    expect(second?.x ?? 0).toBeGreaterThanOrEqual((first?.x ?? 0) + (first?.width ?? 0) + SPARK_BAR_GAP)

    const tight = sparklineGeometry(points, 60, 56)
    expect(tight.bars[0]?.width).toBe(60 / 3 - SPARK_BAR_GAP)
    expect((tight.bars[1]?.x ?? 0) - ((tight.bars[0]?.x ?? 0) + (tight.bars[0]?.width ?? 0))).toBeCloseTo(
      SPARK_BAR_GAP,
    )
  })

  it("scales the bars against the peak and grows them from the baseline", () => {
    const { bars } = sparklineGeometry(points, 300, 56)
    expect(bars[2]?.height).toBe(56)
    expect(bars[2]?.y).toBe(0)
    expect(bars[1]?.height).toBe(28)
    expect(bars[1]?.y).toBe(28)
  })

  it("draws no ink for a zero day and a muted stub for an unknown one", () => {
    const { bars } = sparklineGeometry(
      [
        { key: "a", value: 0 },
        { key: "b", value: null },
        { key: "c", value: 10 },
      ],
      300,
      56,
    )
    expect(bars[0]?.height).toBe(0)
    expect(bars[0]?.path).toBe("")
    expect(bars[0]?.muted).toBe(false)
    expect(bars[1]?.height).toBe(SPARK_BAR_MIN_HEIGHT)
    expect(bars[1]?.muted).toBe(true)
  })

  it("rounds only the top of a bar, leaving the baseline square", () => {
    const { bars } = sparklineGeometry(points, 300, 56)
    const tall = bars[2]?.path ?? ""
    expect(tall.startsWith("M")).toBe(true)
    expect((tall.match(/Q/g) ?? []).length).toBe(2)
    expect(tall.endsWith("Z")).toBe(true)
  })

  it("keeps a flat series on the baseline rather than inventing a peak", () => {
    const { bars } = sparklineGeometry(
      [
        { key: "a", value: 0 },
        { key: "b", value: 0 },
      ],
      100,
      24,
    )
    expect(bars.every((bar) => bar.height === 0)).toBe(true)
  })

  it("builds the polyline from the known points and names the endpoint", () => {
    const geometry = sparklineGeometry(points, 300, 56)
    expect(geometry.polyline).toBe("50,56 150,28 250,0")
    expect(geometry.endIndex).toBe(2)
    expect(geometry.end).toEqual({ key: "c", x: 250, y: 0 })
  })

  it("ends on the last KNOWN point, never on a blank tail", () => {
    const geometry = sparklineGeometry(
      [
        { key: "a", value: 2 },
        { key: "b", value: null },
      ],
      200,
      40,
    )
    expect(geometry.endIndex).toBe(0)
    expect(geometry.end?.key).toBe("a")
  })
})
