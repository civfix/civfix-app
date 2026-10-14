import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  axisLabelPlacement,
  barFraction,
  barRects,
  chartMax,
  clampFraction,
  lineGeometry,
  progressArcPath,
  ringRadius,
  valueToPixels,
  xToPixels,
} from "../chartGeometry"

describe("the y axis starts at zero and never at the smallest value", () => {
  it("takes the largest real value, ignoring suppressed points", () => {
    expect(chartMax([3, null, 9, 4])).toBe(9)
  })

  it("keeps a floor of one so an all-zero series draws a flat line, not a division by zero", () => {
    expect(chartMax([0, 0, 0])).toBe(1)
    expect(chartMax([])).toBe(1)
    expect(chartMax([null, null])).toBe(1)
  })
})

describe("bars", () => {
  it("lays each bar in its own slot, with the gap taken off the width", () => {
    const rects = barRects([{ key: "a", value: 5 }, { key: "b", value: 10 }], 40, 20, { gap: 4 })
    expect(rects).toEqual([
      { key: "a", x: 2, y: 10, width: 16, height: 10 },
      { key: "b", x: 22, y: 0, width: 16, height: 20 },
    ])
  })

  it("reads a suppressed bar as no bar rather than as a full-height one", () => {
    const rects = barRects([{ key: "a", value: null }, { key: "b", value: 4 }], 40, 20)
    expect(rects[0]?.height).toBe(0)
    expect(rects[1]?.height).toBe(20)
  })

  it("scales a horizontal track between nothing and full, and clamps a value past the max", () => {
    expect(barFraction(5, 10)).toBe(0.5)
    expect(barFraction(null, 10)).toBe(0)
    expect(barFraction(5, 0)).toBe(0)
    expect(barFraction(50, 10)).toBe(1)
  })
})

describe("an x-positioned line", () => {
  it("scales the real x domain into the box instead of spacing points evenly", () => {
    const geometry = lineGeometry(
      [
        { x: 100, y: 0 },
        { x: 200, y: 5 },
        { x: 500, y: 10 },
      ],
      40,
      10,
      { max: 10 },
    )
    expect(geometry.line).toBe("M 0,10 L 10,5 L 40,0")
  })

  it("breaks at a suppressed point, and fills only under the longest run", () => {
    const geometry = lineGeometry(
      [
        { x: 0, y: 1 },
        { x: 1, y: null },
        { x: 2, y: 3 },
        { x: 3, y: 4 },
      ],
      30,
      10,
      { max: 4 },
    )
    expect(geometry.line.split("M").length - 1).toBe(2)
    expect(geometry.area?.startsWith("M 20,10")).toBe(true)
  })

  it("draws nothing when every point is suppressed", () => {
    expect(lineGeometry([{ x: 0, y: null }], 30, 10)).toEqual({ line: "", area: null })
  })

  it("survives a single-point domain rather than dividing by a zero span", () => {
    const geometry = lineGeometry([{ x: 7, y: 3 }], 30, 10, { xMin: 7, xMax: 7 })
    expect(geometry.line).toBe("M 0,0")
  })

  it("places a marker and a reference line in the same space the line uses", () => {
    expect(xToPixels(150, 100, 200, 40)).toBe(20)
    expect(xToPixels(150, 100, 100, 40)).toBe(0)
    expect(valueToPixels(5, 10, 20)).toBe(10)
    expect(valueToPixels(5, 0, 20)).toBe(20)
  })
})

describe("the progress ring", () => {
  it("clamps whatever it is handed into 0..1", () => {
    expect(clampFraction(-3)).toBe(0)
    expect(clampFraction(0.4)).toBe(0.4)
    expect(clampFraction(9)).toBe(1)
    expect(clampFraction(Number.NaN)).toBe(0)
  })

  it("draws nothing at zero, one arc under half, and the large-arc flag over it", () => {
    expect(progressArcPath(0, 64)).toBe("")
    expect(progressArcPath(0.25, 64)).toContain(" 0 0 1 ")
    expect(progressArcPath(0.75, 64)).toContain(" 0 1 1 ")
  })

  it("draws a full ring as TWO arcs, because one that meets its own start renders as nothing", () => {
    const full = progressArcPath(1, 64)
    expect(full.split("A").length - 1).toBe(2)
    expect(progressArcPath(2, 64)).toBe(full)
  })

  it("clamps the radius at zero when the stroke is thicker than the ring it draws", () => {
    expect(ringRadius(64, 8)).toBe(28)
    expect(ringRadius(8, 64)).toBe(0)
    expect(ringRadius(0, 8)).toBe(0)
    for (const path of [progressArcPath(0.25, 8, 64), progressArcPath(1, 8, 64)]) {
      expect(path).not.toContain("-")
      expect(path).not.toContain("NaN")
    }
  })
})

describe("x-axis labels stay inside the plot", () => {
  it("anchors a label at the right end by its right edge, so the last tick cannot run off the chart", () => {
    expect(axisLabelPlacement(1, 300)).toEqual({ right: 0, textAlign: "right" })
    expect(axisLabelPlacement(0.9, 300)).toEqual({ right: 0, textAlign: "right" })
  })

  it("anchors every other label by its left edge at its own position", () => {
    expect(axisLabelPlacement(0, 300)).toEqual({ left: 0 })
    expect(axisLabelPlacement(0.5, 300)).toEqual({ left: 150 })
  })

  it("clamps a stray fraction instead of placing a label off the plot", () => {
    expect(axisLabelPlacement(-0.2, 300)).toEqual({ left: 0 })
    expect(axisLabelPlacement(Number.NaN, 300)).toEqual({ left: 0 })
  })
})

describe("the line chart places its ticks through the shared rule", () => {
  const SRC = readFileSync(new URL("../AreaLineChart.tsx", import.meta.url), "utf8")

  it("never left-anchors a tick at its raw pixel x", () => {
    expect(SRC).not.toMatch(/left: xToPixels\(tick\.x/)
    expect(SRC).toContain("axisLabelPlacement(")
  })

  it("exposes both the empty and the drawn chart as one labelled image", () => {
    const views = SRC.match(/<View[^>]*accessibilityLabel=\{accessibilityLabel\}[^>]*>/g) ?? []
    expect(views).toHaveLength(2)
    for (const view of views) {
      expect(view).toContain("accessible ")
      expect(view).toContain('accessibilityRole="image"')
    }
  })
})

describe("the drawn bar chart and the progress ring are each one labelled image", () => {
  const imageRoots = (file: string): string[] => {
    const src = readFileSync(new URL(file, import.meta.url), "utf8")
    return src.match(/<View\s[^>]*accessibilityLabel=\{accessibilityLabel\}[^>]*>/g) ?? []
  }

  it("marks the svg bar chart's root accessible, so its bars are not separate stops", () => {
    const svgRoot = imageRoots("../BarChart.tsx").filter((root) => root.includes("styles.column"))
    expect(svgRoot).toHaveLength(1)
    expect(svgRoot[0]).toMatch(/\baccessible\b/)
    expect(svgRoot[0]).toContain('accessibilityRole="image"')
  })

  it("marks the progress ring's root accessible", () => {
    const roots = imageRoots("../ProgressRing.tsx")
    expect(roots).toHaveLength(1)
    expect(roots[0]).toMatch(/\baccessible\b/)
    expect(roots[0]).toContain('accessibilityRole="image"')
  })
})

