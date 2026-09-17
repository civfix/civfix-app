import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type { BreakdownRow, SeriesPoint } from "@civfix/shared"
import {
  CARD_ARRIVAL_BUCKETS,
  CARD_SLOT_ROWS,
  busiestRows,
  carouselPage,
  latestPoints,
} from "../analyticsModel"

const CARD = readFileSync(
  new URL("../dashboard/AnalyticsCarouselCard.tsx", import.meta.url),
  "utf8",
)

const BAR_CHART = readFileSync(new URL("../../../charts/BarChart.tsx", import.meta.url), "utf8")

const MEASURE = readFileSync(
  new URL("../../../charts/useMeasuredWidth.ts", import.meta.url),
  "utf8",
)

const ANALYTICS_BODY = readFileSync(new URL("../EventAnalyticsBody.tsx", import.meta.url), "utf8")

const constant = (name: string): number => {
  const match = CARD.match(new RegExp(`const ${name} = ([0-9+\\s A-Z_]+)\\n`))
  if (!match) throw new Error(`no constant ${name}`)
  const parts = (match[1] as string).split("+").map((part) => part.trim())
  return parts.reduce((sum, part) => sum + (/^\d+$/.test(part) ? Number(part) : constant(part)), 0)
}

const row = (key: string, value: number | null, suppressed = false): BreakdownRow =>
  ({ key, label: key, value, suppressed }) as BreakdownRow

const point = (day: string, value: number): SeriesPoint =>
  ({ day, value, suppressed: false }) as SeriesPoint

describe("the numbers behind a carousel page", () => {
  it("lands on the page whose width the container measured", () => {
    expect(carouselPage(0, 320, 5)).toBe(0)
    expect(carouselPage(320, 320, 5)).toBe(1)
    expect(carouselPage(1_280, 320, 5)).toBe(4)
  })

  it("never divides by an unmeasured width", () => {
    expect(carouselPage(640, 0, 5)).toBe(0)
    expect(carouselPage(640, Number.NaN, 5)).toBe(0)
    expect(carouselPage(Number.NaN, 320, 5)).toBe(0)
  })

  it("clamps a rubber-band overscroll to a real page", () => {
    expect(carouselPage(-80, 320, 5)).toBe(0)
    expect(carouselPage(9_999, 320, 5)).toBe(4)
    expect(carouselPage(320, 320, 0)).toBe(0)
  })
})

describe("what a glance-sized panel is allowed to plot", () => {
  it("keeps the busiest shifts, so the bars stay inside the panel", () => {
    const rows = [row("a", 1), row("b", 9), row("c", 4), row("d", 7), row("e", 2), row("f", 6)]
    expect(busiestRows(rows).map((r) => r.key)).toEqual(["b", "d", "f", "c"])
    expect(busiestRows(rows)).toHaveLength(CARD_SLOT_ROWS)
  })

  it("sinks a suppressed shift below every countable one", () => {
    const rows = [row("hidden", null, true), row("a", 0), row("b", 3)]
    expect(busiestRows(rows).map((r) => r.key)).toEqual(["b", "a", "hidden"])
  })

  it("returns everything it has when there is less than a panelful", () => {
    expect(busiestRows([row("a", 1)])).toHaveLength(1)
    expect(busiestRows([])).toEqual([])
    expect(busiestRows([row("a", 1)], 0)).toEqual([])
  })

  it("plots the most recent arrival buckets rather than a hairline smear", () => {
    const points = Array.from({ length: 60 }, (_unused, i) => point(`b${i}`, i))
    const tail = latestPoints(points)
    expect(tail).toHaveLength(CARD_ARRIVAL_BUCKETS)
    expect(tail[0]?.day).toBe(`b${60 - CARD_ARRIVAL_BUCKETS}`)
    expect(tail[tail.length - 1]?.day).toBe("b59")
    expect(latestPoints(points.slice(0, 3))).toHaveLength(3)
    expect(latestPoints(points, 0)).toEqual([])
  })
})

describe("the carousel measures itself and lets the chart be the panel", () => {
  it("takes its page width from one onLayout, never from the window", () => {
    expect(CARD).toContain("useMeasuredWidth()")
    expect(CARD).toContain("<View style={styles.viewport} onLayout={onLayout}>")
    expect(CARD).not.toContain("Dimensions")
    expect(CARD).not.toContain("useWindowDimensions")
    expect(MEASURE).not.toContain("Dimensions")
  })

  it("draws nothing at all until that width is real", () => {
    expect(CARD).toContain("{width > 0 ? (")
    expect(CARD).toContain("{IS_WEB && width > 0 && index > 0 ? (")
    expect(CARD).toContain("{IS_WEB && width > 0 && index < panels.length - 1 ? (")
  })

  it("pages on the measured width and clips every panel to it", () => {
    expect(CARD).toContain("snapToInterval={width}")
    expect(CARD).toContain('decelerationRate="fast"')
    expect(CARD).toContain("pagingEnabled")
    expect(CARD).toContain("{ width },")
    expect(CARD).toMatch(/panel: \{\n\s+height: PANEL_HEIGHT,\n\s+overflow: "hidden",/)
  })

  it("reads the active page off the settled offset, not off every scroll frame", () => {
    expect(CARD).toContain("onMomentumScrollEnd={onMomentumScrollEnd}")
    expect(CARD).toContain("carouselPage(event.nativeEvent.contentOffset.x, width, panels.length)")
    expect(CARD).not.toContain("onScroll=")
    expect(CARD).not.toContain("scrollEventThrottle")
    expect(CARD).not.toContain("accessibilityLiveRegion")
  })

  it("gives the chart the bulk of the panel, at a height a phone can read", () => {
    const chart = constant("CHART_HEIGHT")
    const panel = constant("PANEL_HEIGHT")
    expect(chart).toBeGreaterThanOrEqual(120)
    expect(chart / panel).toBeGreaterThanOrEqual(0.7)
    expect(constant("HEADER_HEIGHT")).toBeLessThanOrEqual(34)
  })

  it("hands every chart the measured width and an explicit numeric height", () => {
    expect(CARD.match(/width=\{width\}/g) ?? []).not.toHaveLength(0)
    expect(CARD).toContain("height={CHART_HEIGHT}")
    expect(CARD).toContain("const barsWidth = Math.max(0, width - RING_SIZE - RING_GUTTER)")
    expect(CARD).toContain("width={barsWidth}")
    expect(CARD).not.toMatch(/width=\{`\$\{/)
    expect(CARD).not.toContain('width: "100%"')
  })

  it("makes every one of the five panels a chart", () => {
    expect(CARD.match(/<AreaLineChart/g) ?? [], "signups, reach and the flat empty state")
      .toHaveLength(3)
    expect(CARD.match(/<BarChart/g) ?? [], "shifts, arrivals and impact").toHaveLength(3)
    expect(CARD).toContain("<ProgressRing")
    expect(CARD).toContain("busiestRows(data.signups.bySlot?.rows ?? [])")
    expect(CARD).toContain("latestPoints(data.eventDay.arrivals)")
  })

  it("shapes the empty states like an axis rather than a sentence", () => {
    expect(CARD).toContain("function EmptyChart({ width, label }")
    expect(CARD).toContain("series={FLAT_SERIES}")
    expect(CARD.match(/<EmptyChart/g) ?? []).toHaveLength(4)
  })

  it("keeps every page the same height so the card cannot jump", () => {
    expect(CARD).toMatch(/viewport: \{\n\s+height: PANEL_HEIGHT,\n\s+\}/)
    expect(CARD).toMatch(/frame: \{\n\s+height: PANEL_HEIGHT,/)
    expect(CARD).toMatch(/chart: \{\n\s+height: CHART_HEIGHT,/)
    expect(CARD).toMatch(/emptyChart: \{\n\s+height: CHART_HEIGHT,/)
    expect(CARD).toMatch(/checkins: \{\n\s+height: CHART_HEIGHT,/)
  })

  it("leaves no raw hex behind", () => {
    expect(CARD).not.toContain('"#')
    expect(CARD).not.toContain("brand.bloom")
  })
})

describe("the chart primitives size themselves from what a parent measured", () => {
  it("lets a horizontal bar row take a measured width instead of a percentage", () => {
    expect(BAR_CHART).toContain("const measured = width > 0 ? width : null")
    expect(BAR_CHART).toContain("measured ? { width: measured } : null")
    expect(BAR_CHART).toContain("barFraction(bar.value, max) * measured")
  })

  it("measures inside the padded card on the full analytics page, not outside it", () => {
    expect(ANALYTICS_BODY).toContain("useMeasuredWidth")
    expect(ANALYTICS_BODY.match(/onLayout=\{onLayout\}/g) ?? []).toHaveLength(3)
    expect(ANALYTICS_BODY).not.toContain("chartWidth")
    expect(ANALYTICS_BODY).toContain("<SignupsSection data={data} range={range}")
    expect(ANALYTICS_BODY).toContain("<EventDaySection data={data} />")
  })
})
