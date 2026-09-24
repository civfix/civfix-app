import { describe, expect, it } from "vitest"

import { formatCompact, niceTicks } from "./chart-utils"

describe("niceTicks", () => {
  it("keeps fractional steps by default", () => {
    expect(niceTicks(1, 3)).toEqual([0, 0.5, 1])
  })

  it("never steps below 1 in integer mode, so count axes carry no duplicate labels", () => {
    expect(niceTicks(1, 3, { integer: true })).toEqual([0, 1])
    expect(niceTicks(1, 4, { integer: true })).toEqual([0, 1])
    expect(niceTicks(2, 3, { integer: true })).toEqual([0, 1, 2])
    expect(niceTicks(2, 4, { integer: true })).toEqual([0, 1, 2])
    expect(niceTicks(3, 3, { integer: true })).toEqual([0, 1, 2, 3])
    expect(niceTicks(3, 4, { integer: true })).toEqual([0, 1, 2, 3])
  })

  it("leaves larger integer axes on their usual nice step", () => {
    expect(niceTicks(40, 4, { integer: true })).toEqual([0, 10, 20, 30, 40])
  })

  it("renders every integer-mode label distinctly", () => {
    for (const max of [1, 2, 3]) {
      for (const count of [3, 4]) {
        const labels = niceTicks(max, count, { integer: true }).map(formatCompact)
        expect(new Set(labels).size).toBe(labels.length)
      }
    }
  })
})
