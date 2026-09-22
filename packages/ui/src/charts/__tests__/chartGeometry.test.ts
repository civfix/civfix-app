import { describe, expect, it } from "vitest"
import {
  barFraction,
  barRects,
  chartMax,
  clampFraction,
  lineGeometry,
  progressArcPath,
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
})
