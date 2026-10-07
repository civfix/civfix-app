import { describe, expect, it } from "vitest"
import {
  MAX_SERIES_DAYS,
  seriesClosure,
  arrivalsCurve,
  bestDayTime,
  breakdown,
  dailySeries,
  enumerateDays,
  funnel,
  type DayCount,
  type DayRange,
  type DerivedSeriesPanel,
  type SuppressOptions,
} from "../derive.js"

// The cumulative panel as the backend publishes it: the closure's running totals, and the total only
// when the closure marks it publishable.
function cumulativeView(
  points: readonly DayCount[],
  range: DayRange,
  options: SuppressOptions = {},
): DerivedSeriesPanel {
  const closure = seriesClosure(points, range, options)
  return {
    panelSuppressed: closure.panelSuppressed,
    total: closure.totalPublishable ? closure.total : null,
    points: closure.cumulative,
  }
}

describe("enumerateDays", () => {
  it("gap-fills an inclusive range across a month boundary", () => {
    expect(enumerateDays({ from: "2026-01-30", to: "2026-02-02" })).toEqual([
      "2026-01-30",
      "2026-01-31",
      "2026-02-01",
      "2026-02-02",
    ])
  })

  it("handles a leap day", () => {
    expect(enumerateDays({ from: "2028-02-28", to: "2028-03-01" })).toEqual([
      "2028-02-28",
      "2028-02-29",
      "2028-03-01",
    ])
  })

  it("refuses malformed, inverted and unbounded ranges", () => {
    expect(() => enumerateDays({ from: "2026-1-1", to: "2026-01-05" })).toThrow(RangeError)
    expect(() => enumerateDays({ from: "2026-02-30", to: "2026-03-05" })).toThrow(RangeError)
    expect(() => enumerateDays({ from: "2026-03-05", to: "2026-03-01" })).toThrow(RangeError)
    expect(() => enumerateDays({ from: "2020-01-01", to: "2026-01-01" })).toThrow(RangeError)
    expect(enumerateDays({ from: "2026-01-01", to: "2026-01-01" })).toHaveLength(1)
    expect(MAX_SERIES_DAYS).toBe(400)
  })
})

describe("dailySeries", () => {
  const range = { from: "2026-05-01", to: "2026-05-05" }

  it("fills missing days with zero and keeps the range order", () => {
    const panel = dailySeries([{ day: "2026-05-03", count: 6 }], range)
    expect(panel.points.map((p) => p.day)).toEqual([
      "2026-05-01",
      "2026-05-02",
      "2026-05-03",
      "2026-05-04",
      "2026-05-05",
    ])
    expect(panel.points.map((p) => p.value)).toEqual([0, 0, 6, 0, 0])
    expect(panel.total).toBe(6)
    expect(panel.panelSuppressed).toBe(false)
  })

  it("suppresses the whole panel when the total is under k", () => {
    const panel = dailySeries([{ day: "2026-05-02", count: 4 }], range)
    expect(panel.panelSuppressed).toBe(true)
    expect(panel.total).toBeNull()
    expect(panel.points.every((p) => p.value === null && p.suppressed)).toBe(true)
  })

  it("can also suppress individual points when asked", () => {
    const panel = dailySeries(
      [
        { day: "2026-05-01", count: 3 },
        { day: "2026-05-02", count: 9 },
      ],
      range,
      { suppressPoints: true },
    )
    expect(panel.panelSuppressed).toBe(false)
    expect(panel.points[0]?.value).toBeNull()
    expect(panel.points[1]?.value).toBe(9)
  })

  it("drops points outside the range and sums duplicates", () => {
    const panel = dailySeries(
      [
        { day: "2026-04-30", count: 100 },
        { day: "2026-05-01", count: 3 },
        { day: "2026-05-01", count: 4 },
      ],
      range,
    )
    expect(panel.total).toBe(7)
    expect(panel.points[0]?.value).toBe(7)
  })
})

describe("breakdown", () => {
  it("yields the panel, not the total, when a shown row would pin the hidden one", () => {
    const panel = breakdown([
      { key: "direct", count: 12 },
      { key: "social", count: 3 },
      { key: "search", count: 6 },
    ])
    expect(panel.panelSuppressed).toBe(true)
    expect(panel.total).toBe(21)
    expect(panel.rows).toEqual([])
  })

  it("hides the smallest shown rows first and stops as soon as the group is safe", () => {
    const panel = breakdown([
      { key: "a", count: 40 },
      { key: "b", count: 5 },
      { key: "c", count: 1 },
      { key: "d", count: 1 },
    ])
    expect(panel.panelSuppressed).toBe(false)
    expect(panel.rows.map((r) => [r.key, r.value])).toEqual([
      ["a", 40],
      ["b", null],
      ["c", null],
      ["d", null],
    ])
    expect(panel.total).toBe(47)
    expect(panel.rows[0]?.share).toBe(0.8511)
  })

  it("suppresses the whole panel when an upstream closure withholds the total", () => {
    const panel = breakdown(
      [
        { key: "a", count: 40 },
        { key: "b", count: 11 },
      ],
      { totalPublishable: false },
    )
    expect(panel.panelSuppressed).toBe(true)
    expect(panel.total).toBeNull()
    expect(panel.rows).toEqual([])
  })

  it("keeps the total and the shares when the hidden rows cannot be pinned", () => {
    const panel = breakdown([
      { key: "direct", count: 12 },
      { key: "social", count: 2 },
      { key: "search", count: 6 },
      { key: "email", count: 2 },
    ])
    expect(panel.total).toBe(22)
    expect(panel.rows.find((r) => r.key === "direct")?.share).toBe(0.5455)
    expect(panel.rows.filter((r) => r.suppressed).every((r) => r.share === null)).toBe(true)
  })

  it("suppresses the whole panel when the total is under k", () => {
    const panel = breakdown([{ key: "direct", count: 4 }])
    expect(panel.panelSuppressed).toBe(true)
    expect(panel.total).toBeNull()
    expect(panel.rows).toEqual([])
  })

  it("orders by value then key for determinism", () => {
    const panel = breakdown([
      { key: "b", count: 7 },
      { key: "a", count: 7 },
      { key: "c", count: 9 },
    ])
    expect(panel.rows.map((r) => r.key)).toEqual(["c", "a", "b"])
  })
})

describe("funnel", () => {
  it("clamps each step to the previous one so it can never widen", () => {
    const panel = funnel([
      { key: "views", count: 100 },
      { key: "starts", count: 140 },
      { key: "registered", count: 40 },
      { key: "checked_in", count: 55 },
    ])
    expect(panel.rows.map((r) => r.value)).toEqual([100, 100, 40, 40])
    expect(panel.rows[2]?.conversionFromFirst).toBe(0.4)
  })

  it("suppresses the panel when the first step is under k", () => {
    const panel = funnel([
      { key: "views", count: 4 },
      { key: "registered", count: 2 },
    ])
    expect(panel.panelSuppressed).toBe(true)
    expect(panel.rows.every((r) => r.value === null && r.conversionFromFirst === null)).toBe(true)
  })
})

describe("arrivalsCurve", () => {
  it("buckets offsets deterministically and clamps outliers", () => {
    const panel = arrivalsCurve([-500, -10, 0, 1, 14, 15, 4000], {
      bucketMinutes: 15,
      fromMinutes: -30,
      toMinutes: 30,
    })
    expect(panel.rows.map((r) => r.offsetMinutes)).toEqual([-30, -15, 0, 15])
    expect(panel.rows.map((r) => r.value)).toEqual([1, 1, 3, 2])
    expect(panel.total).toBe(7)
  })

  it("suppresses the panel under k and refuses unbounded bucket counts", () => {
    expect(arrivalsCurve([1, 2]).panelSuppressed).toBe(true)
    expect(() => arrivalsCurve([1], { bucketMinutes: 1, fromMinutes: 0, toMinutes: 5000 })).toThrow(
      RangeError,
    )
    expect(() => arrivalsCurve([1], { fromMinutes: 10, toMinutes: 10 })).toThrow(RangeError)
  })

  it("spans two hours before to four hours after in 15-minute buckets unless given integer options", () => {
    const defaults = arrivalsCurve([])
    expect(defaults.rows).toHaveLength(24)
    expect(defaults.rows[0]?.offsetMinutes).toBe(-120)
    expect(defaults.rows[23]?.offsetMinutes).toBe(225)
    const ignored = arrivalsCurve([], { bucketMinutes: 0, fromMinutes: 1.5, toMinutes: Number.NaN })
    expect(ignored.rows.map((r) => r.offsetMinutes)).toEqual(defaults.rows.map((r) => r.offsetMinutes))
    expect(arrivalsCurve([], { bucketMinutes: -15 }).rows).toHaveLength(24)
    expect(arrivalsCurve([], { bucketMinutes: 7.5 }).rows).toHaveLength(24)
    expect(arrivalsCurve([], { fromMinutes: -60, toMinutes: 0, bucketMinutes: 30 }).rows.map((r) => r.offsetMinutes)).toEqual([
      -60, -30,
    ])
  })
})

describe("bestDayTime", () => {
  it("picks the highest cell and breaks ties by lowest weekday then hour", () => {
    expect(
      bestDayTime([
        { weekday: 6, hour: 10, count: 9 },
        { weekday: 2, hour: 18, count: 9 },
        { weekday: 2, hour: 9, count: 9 },
      ]),
    ).toEqual({ weekday: 2, hour: 9, value: 9 })
  })

  it("returns null when the winner is under k", () => {
    expect(bestDayTime([{ weekday: 1, hour: 8, count: 4 }])).toBeNull()
    expect(bestDayTime([])).toBeNull()
  })

  it("ignores out-of-range cells", () => {
    expect(bestDayTime([{ weekday: 9, hour: 40, count: 100 }])).toBeNull()
  })
})

describe("seriesClosure cumulative view", () => {
  const range = { from: "2026-05-01", to: "2026-05-05" }

  it("publishes no step at all once the hidden tail could be pinned by the total", () => {
    const panel = cumulativeView(
      [
        { day: "2026-05-01", count: 6 },
        { day: "2026-05-02", count: 2 },
        { day: "2026-05-03", count: 7 },
      ],
      range,
    )
    expect(panel.panelSuppressed).toBe(false)
    expect(panel.points.map((p) => p.value)).toEqual([null, null, null, null, null])
    expect(panel.total).toBeNull()
    const shown = panel.points.filter((p) => !p.suppressed).map((p) => p.value as number)
    for (let i = 1; i < shown.length; i += 1) {
      const delta = (shown[i] as number) - (shown[i - 1] as number)
      expect(delta === 0 || delta >= 5).toBe(true)
    }
  })

  it("waits for the hidden group to reach a revealable band, then shows the total again", () => {
    const panel = cumulativeView(
      [
        { day: "2026-05-01", count: 10 },
        { day: "2026-05-02", count: 3 },
        { day: "2026-05-03", count: 3 },
        { day: "2026-05-04", count: 30 },
      ],
      range,
    )
    expect(panel.points.map((p) => p.value)).toEqual([10, null, null, null, 46])
    expect(panel.total).toBe(46)
  })

  it("suppresses the whole panel below k", () => {
    const panel = cumulativeView([{ day: "2026-05-02", count: 3 }], range)
    expect(panel.panelSuppressed).toBe(true)
    expect(panel.total).toBeNull()
    expect(panel.points.every((p) => p.value === null && p.suppressed)).toBe(true)
  })

  it("shows a leading run of zeroes without disclosing anything", () => {
    const panel = cumulativeView([{ day: "2026-05-05", count: 9 }], range)
    expect(panel.points.map((p) => p.value)).toEqual([0, 0, 0, 0, 9])
  })

  it("ignores days outside the range", () => {
    const panel = cumulativeView(
      [
        { day: "2026-04-30", count: 100 },
        { day: "2026-05-02", count: 8 },
      ],
      range,
    )
    expect(panel.total).toBe(8)
    expect(panel.points.at(-1)?.value).toBe(8)
  })
})


describe("complementary suppression across the daily, cumulative and total views", () => {
  const range = { from: "2026-05-01", to: "2026-05-03" }
  const points = [
    { day: "2026-05-01", count: 6 },
    { day: "2026-05-02", count: 2 },
    { day: "2026-05-03", count: 7 },
  ]

  it("leaks the sub-k day through NO combination of the three published views", () => {
    const daily = dailySeries(points, range, { suppressPoints: true })
    const cumulative = cumulativeView(points, range)

    expect(daily.points.map((p) => p.value)).toEqual([6, null, 7])
    expect(daily.total).toBeNull()
    expect(cumulative.points.map((p) => p.value)).toEqual([null, null, null])
    expect(cumulative.total).toBeNull()

    const published: number[] = [
      ...daily.points.map((p) => p.value),
      ...cumulative.points.map((p) => p.value),
      daily.total,
      cumulative.total,
    ].filter((v): v is number => v !== null)

    const derivable = new Set<number>(published)
    for (const a of published) {
      for (const b of published) derivable.add(a - b)
    }
    expect(derivable.has(2)).toBe(false)
    expect(derivable.has(-2)).toBe(false)
  })

  it("publishes everything when nothing is hidden", () => {
    const open = [
      { day: "2026-05-01", count: 6 },
      { day: "2026-05-02", count: 5 },
      { day: "2026-05-03", count: 7 },
    ]
    const daily = dailySeries(open, range, { suppressPoints: true })
    const cumulative = cumulativeView(open, range)
    expect(daily.points.map((p) => p.value)).toEqual([6, 5, 7])
    expect(daily.total).toBe(18)
    expect(cumulative.points.map((p) => p.value)).toEqual([6, 11, 18])
    expect(cumulative.total).toBe(18)
  })
})


const K = 5
const DAY0 = Date.UTC(2026, 4, 1)

function dayAt(index: number): string {
  return new Date(DAY0 + index * 86400000).toISOString().slice(0, 10)
}

function rangeOf(length: number) {
  return { from: dayAt(0), to: dayAt(length - 1) }
}

function countsOf(values: readonly number[]) {
  return values.map((count, index) => ({ day: dayAt(index), count }))
}

function publishedOf(values: readonly number[], k = K) {
  const range = rangeOf(values.length)
  const points = countsOf(values)
  const daily = dailySeries(points, range, { suppressPoints: true, k })
  const cumulative = cumulativeView(points, range, { k })
  return {
    daily: daily.points.map((p) => p.value),
    dailyTotal: daily.total,
    cumulative: cumulative.points.map((p) => p.value),
    cumulativeTotal: cumulative.total,
  }
}

function agreesWithPublished(
  candidate: readonly number[],
  published: ReturnType<typeof publishedOf>,
): boolean {
  let running = 0
  for (const [index, value] of candidate.entries()) {
    running += value
    const step = published.cumulative[index]
    if (step !== null && step !== undefined && step !== running) return false
  }
  if (published.dailyTotal !== null && published.dailyTotal !== running) return false
  if (published.cumulativeTotal !== null && published.cumulativeTotal !== running) return false
  return true
}

function feasibleValues(values: readonly number[], k = K): Map<number, Set<number>> {
  const hiddenIndexes = values.flatMap((value, index) => (value < k ? [index] : []))
  const published = publishedOf(values, k)
  const feasible = new Map<number, Set<number>>()
  for (const index of hiddenIndexes) feasible.set(index, new Set<number>())
  const candidate = [...values]
  const walk = (depth: number): void => {
    if (depth === hiddenIndexes.length) {
      if (!agreesWithPublished(candidate, published)) return
      for (const index of hiddenIndexes) feasible.get(index)?.add(candidate[index] as number)
      return
    }
    const index = hiddenIndexes[depth] as number
    for (let value = 0; value < k; value++) {
      candidate[index] = value
      walk(depth + 1)
    }
    candidate[index] = values[index] as number
  }
  walk(0)
  return feasible
}

function prefixCuts(values: readonly number[], k = K): number[] {
  const published = publishedOf(values, k)
  const cuts = published.cumulative.flatMap((value, index) => (value === null ? [] : [index]))
  if (published.cumulativeTotal !== null || published.dailyTotal !== null) cuts.push(values.length - 1)
  return [...new Set(cuts)].sort((a, b) => a - b)
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe("bounded inference: a hidden cell never narrows below the day rule", () => {
  it("withholds the total when the revealed mass would pin every hidden day (reviewer case A)", () => {
    const published = publishedOf([4, 4, 10])
    expect(published.daily).toEqual([null, null, 10])
    expect(published.dailyTotal).toBeNull()
    expect(published.cumulative).toEqual([null, null, null])
    expect(published.cumulativeTotal).toBeNull()
  })

  it("withholds the interior cumulative step of reviewer case B", () => {
    const published = publishedOf([10, 4, 4, 30])
    expect(published.daily).toEqual([10, null, null, 30])
    expect(published.cumulative).toEqual([null, null, null, null])
    expect(published.cumulativeTotal).toBeNull()
  })

  it("publishes a three-cell hidden group only inside [k-1, (n-1)(k-1)]", () => {
    expect(publishedOf([10, 4, 4, 4, 30]).cumulativeTotal).toBeNull()
    expect(publishedOf([10, 4, 1, 1, 30]).cumulativeTotal).toBe(46)
    expect(publishedOf([10, 0, 0, 0, 30]).cumulativeTotal).toBe(40)
    expect(publishedOf([10, 1, 0, 0, 30]).cumulativeTotal).toBeNull()
  })

  it("keeps the terminal number out of reach for the backend review cases", () => {
    const a = seriesClosure(countsOf([8, 4, 3, 4, 11]), rangeOf(5), { suppressPoints: true })
    expect(a.totalPublishable).toBe(false)
    expect(a.cumulative.every((p) => p.value === null)).toBe(true)
    expect(a.daily.map((p) => p.value)).toEqual([8, null, null, null, 11])

    const b = seriesClosure(countsOf([6, 6, 5, 10, 1, 7]), rangeOf(6), { suppressPoints: true })
    expect(b.totalPublishable).toBe(false)
    expect(b.cumulative.every((p) => p.value === null)).toBe(true)
    expect(b.daily.map((p) => p.value)).toEqual([6, 6, 5, 10, null, 7])
  })

  it("trades an interior step for the terminal number when that keeps both safe", () => {
    const closure = seriesClosure(countsOf([4, 0, 10, 4]), rangeOf(4), { suppressPoints: true })
    expect(closure.cumulative.map((p) => p.value)).toEqual([null, null, null, 18])
    expect(closure.totalPublishable).toBe(true)
  })

  it("leaves every hidden cell its full [0, k-1] interval across random small series", () => {
    const random = mulberry32(20260906)
    for (let trial = 0; trial < 300; trial++) {
      const length = 3 + Math.floor(random() * 4)
      const values = Array.from({ length }, () => Math.floor(random() * 11))
      if (values.reduce((sum, v) => sum + v, 0) < K) continue

      for (const [index, feasible] of feasibleValues(values)) {
        const seen = [...feasible].sort((a, b) => a - b)
        const full = Array.from({ length: K }, (_, v) => v)
        const label = `${JSON.stringify(values)} cell ${index}`
        if (seen.length === 1) {
          expect(seen, label).toEqual([0])
          expect(values[index], label).toBe(0)
          continue
        }
        expect(seen, label).toEqual(full)
      }

      const cuts = prefixCuts(values)
      let previous = -1
      for (const cut of cuts) {
        const group = values.slice(previous + 1, cut + 1).filter((v) => v < K)
        const mass = group.reduce((sum, v) => sum + v, 0)
        const label = `${JSON.stringify(values)} gap ${previous}->${cut}`
        expect(mass === 0 || (mass >= K - 1 && mass <= (group.length - 1) * (K - 1)), label).toBe(
          true,
        )
        previous = cut
      }
    }
  })
})


function breakdownPublished(values: readonly number[], k = K) {
  const panel = breakdown(
    values.map((count, index) => ({ key: `r${index}`, count })),
    { k },
  )
  const byIndex = new Map<number, number | null>()
  for (const row of panel.rows) byIndex.set(Number(row.key.slice(1)), row.value)
  const hidden = [...byIndex].filter(([, value]) => value === null).map(([index]) => index)
  let shownMass = 0
  for (const [, value] of byIndex) shownMass += value ?? 0
  return {
    panelSuppressed: panel.panelSuppressed,
    total: panel.total,
    rowCount: panel.rows.length,
    byIndex,
    hidden,
    hiddenMass: panel.total === null ? null : panel.total - shownMass,
    shownMass,
  }
}

function feasibleBreakdownValues(values: readonly number[], k = K): Map<number, Set<number>> {
  const published = breakdownPublished(values, k)
  const feasible = new Map<number, Set<number>>()
  for (const index of published.hidden) feasible.set(index, new Set<number>())
  const candidate = published.hidden.map(() => 0)
  const walk = (depth: number): void => {
    if (depth === published.hidden.length) {
      if (published.total !== null) {
        let sum = published.shownMass
        for (const value of candidate) sum += value
        if (sum !== published.total) return
      }
      published.hidden.forEach((index, slot) => feasible.get(index)?.add(candidate[slot] as number))
      return
    }
    for (let value = 0; value < k; value++) {
      candidate[depth] = value
      walk(depth + 1)
    }
    candidate[depth] = 0
  }
  walk(0)
  return feasible
}

describe("breakdown closure: a published total never pins a hidden row", () => {
  it("keeps the KPI and yields the panel when one shown row would pin the other (reviewer case)", () => {
    const published = breakdownPublished([20, 3])
    expect(published.panelSuppressed).toBe(true)
    expect(published.total).toBe(23)
    expect(published.rowCount).toBe(0)
  })

  it("cascades past two small rows the same way", () => {
    const published = breakdownPublished([20, 3, 4])
    expect(published.panelSuppressed).toBe(true)
    expect(published.total).toBe(27)
    expect(published.rowCount).toBe(0)
  })

  it("publishes rows whose hidden complement already sits in the band", () => {
    const published = breakdownPublished([20, 2, 2])
    expect(published.panelSuppressed).toBe(false)
    expect(published.byIndex.get(0)).toBe(20)
    expect(published.hiddenMass).toBe(4)
  })

  it("leaves every hidden row its full [0, k-1] interval across random small breakdowns", () => {
    const random = mulberry32(20260907)
    let suppressedPanels = 0
    let partialPanels = 0
    for (let trial = 0; trial < 400; trial++) {
      const length = 2 + Math.floor(random() * 5)
      const values = Array.from({ length }, () => Math.floor(random() * 12))
      const published = breakdownPublished(values)
      const label = JSON.stringify(values)

      for (const row of published.byIndex) {
        if (row[1] !== null) expect(row[1] >= K, `${label} shown row`).toBe(true)
      }
      if (published.panelSuppressed) {
        suppressedPanels += 1
        expect(published.rowCount, `${label} suppressed panel`).toBe(0)
        continue
      }
      expect(published.total, label).toBe(values.reduce((sum, value) => sum + value, 0))
      if (published.hidden.length === 0) {
        expect(published.hiddenMass, label).toBe(0)
        continue
      }

      const feasible = feasibleBreakdownValues(values)
      const hiddenMass = published.hiddenMass as number
      partialPanels += 1
      for (const [index, set] of feasible) {
        const seen = [...set].sort((a, b) => a - b)
        const cell = `${label} cell ${index}`
        if (seen.length === 1) {
          expect(seen, cell).toEqual([0])
          expect(hiddenMass, cell).toBe(0)
          continue
        }
        expect(seen, cell).toEqual(Array.from({ length: K }, (_, value) => value))
      }
    }
    expect(suppressedPanels).toBeGreaterThan(20)
    expect(partialPanels).toBeGreaterThan(20)
  })
})
