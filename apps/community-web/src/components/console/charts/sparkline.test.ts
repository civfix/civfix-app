import { describe, expect, it } from "vitest"

import { valueRuns } from "./chart-utils"

describe("valueRuns", () => {
  it("keeps a run of real values together", () => {
    expect(valueRuns([3, 1, 4])).toEqual([
      [
        { index: 0, value: 3 },
        { index: 1, value: 1 },
        { index: 2, value: 4 },
      ],
    ])
  })

  it("breaks the line at a k-suppressed point instead of drawing through zero", () => {
    expect(valueRuns([3, null, 4])).toEqual([
      [{ index: 0, value: 3 }],
      [{ index: 2, value: 4 }],
    ])
  })

  it("keeps the x index of every point so a gap stays a gap", () => {
    const runs = valueRuns([null, null, 7, 8])
    expect(runs).toHaveLength(1)
    expect(runs[0]?.map((point) => point.index)).toEqual([2, 3])
  })

  it("never invents a value for a suppressed point", () => {
    const values = [null, 0, null, 5, null]
    const flattened = valueRuns(values).flat()
    expect(flattened.map((point) => point.value)).toEqual([0, 5])
    expect(flattened).toHaveLength(values.filter((value) => value !== null).length)
  })

  it("returns no runs for an all-suppressed series", () => {
    expect(valueRuns([null, null])).toEqual([])
  })
})
