import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { expectThemeTouchTarget, surfaceSource } from "../../../__tests__/sourceGuards"
import { carouselPage } from "../analyticsModel"

const CARD = readFileSync(
  new URL("../dashboard/AnalyticsCarouselCard.tsx", import.meta.url),
  "utf8",
)

const BAR_CHART = readFileSync(new URL("../../../charts/BarChart.tsx", import.meta.url), "utf8")

const MEASURE = readFileSync(
  new URL("../../../charts/useMeasuredWidth.ts", import.meta.url),
  "utf8",
)

const ANALYTICS_BODY = surfaceSource("eventAnalytics")

const constant = (name: string): number => {
  const match = CARD.match(new RegExp(`const ${name} = ([0-9+\\s A-Z_]+)\\n`))
  if (!match) throw new Error(`no constant ${name}`)
  const parts = (match[1] as string).split("+").map((part) => part.trim())
  return parts.reduce((sum, part) => sum + (/^\d+$/.test(part) ? Number(part) : constant(part)), 0)
}

describe("the numbers behind a carousel page", () => {
  it("lands on the page whose width the container measured", () => {
    expect(carouselPage(0, 320, 4)).toBe(0)
    expect(carouselPage(320, 320, 4)).toBe(1)
    expect(carouselPage(960, 320, 4)).toBe(3)
  })

  it("never divides by an unmeasured width", () => {
    expect(carouselPage(640, 0, 4)).toBe(0)
    expect(carouselPage(640, Number.NaN, 4)).toBe(0)
    expect(carouselPage(Number.NaN, 320, 4)).toBe(0)
  })

  it("clamps a rubber-band overscroll to a real page", () => {
    expect(carouselPage(-80, 320, 4)).toBe(0)
    expect(carouselPage(9_999, 320, 4)).toBe(3)
    expect(carouselPage(320, 320, 0)).toBe(0)
  })
})

describe("the card reads the host's whole last 30 days, not one chosen event", () => {
  it("takes an org scope rather than an event id", () => {
    expect(CARD).toContain("export interface AnalyticsCarouselCardProps {\n  orgId: string | null\n}")
    expect(CARD).toContain("useHostAnalyticsSummary(orgId)")
    expect(CARD).not.toContain("cleanupId")
    expect(CARD).not.toContain("useEventAnalytics")
  })

  it("shows the same four panels whatever phase the host's events are in", () => {
    expect(CARD).toContain("const panels = SUMMARY_PANELS")
    expect(CARD).not.toContain("visibleAnalyticsPanels")
    expect(CARD).not.toContain("data.phase")
    expect(CARD).not.toContain("isArchivalEvent")
  })

  it("names the window in the card header instead of a per-panel caption", () => {
    expect(CARD).toContain('{t("card.window")}')
    expect(CARD).not.toMatch(/card\.caption_/)
  })

  it("has dropped the shifts panel and the reach panel outright", () => {
    expect(CARD).not.toContain("bySlot")
    expect(CARD).not.toContain("busiestRows(data.signups")
    expect(CARD).not.toContain("viewsDaily")
    expect(CARD).not.toContain("reachRateVisible")
  })

  it("opens the all-events page rather than one event's analytics", () => {
    expect(CARD).toContain('push({ kind: "host-analytics" })')
    expect(CARD).not.toContain('kind: "event-analytics"')
  })
})

describe("the whole card is one pressable surface, clipped to its own radius", () => {
  it("is a list card whose rows can fill edge to edge", () => {
    expect(CARD.match(/<SectionCard label=\{heading\} trailing=\{window\} variant="list">/g) ?? [])
      .toHaveLength(3)
    expect(CARD.match(/\{footer\}/g) ?? []).toHaveLength(3)
  })

  it("carries the carousel's own horizontal padding on the row, not on the card", () => {
    expect(CARD).toContain("<View style={styles.pad}>")
    expect(CARD).toMatch(/pad: \{\n\s+paddingHorizontal: t\.space\["5"\],\n\s+\}/)
  })

  it("keeps the stat panels inert: only the web chevrons are pressable", () => {
    expect(CARD.match(/state\.pressed \|\| webHover\(state\)/g) ?? []).toHaveLength(2)
    expect(CARD.match(/webHover\(state\)/g) ?? [], "no hover-only branch is left").toHaveLength(2)
    expect(CARD).not.toContain("panelHovered")
    expect(CARD).toMatch(/panels\.map\(\(panel, position\) => \(\n\s+<View/)
  })

  it("draws the footer row without a pressed or hover fill", () => {
    expect(CARD).toContain("pressedHighlight={false}")
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
    expect(CARD).toContain("{...pageSettleProps}")
    expect(CARD).toContain(": { onMomentumScrollEnd: onPageSettled }")
    expect(CARD).toContain("carouselPage(event.nativeEvent.contentOffset.x, width, panels.length)")
    expect(CARD).not.toContain("onScroll=")
  })

  it("tracks the page on web too, where react-native-web never emits momentum events", () => {
    expect(CARD).toContain("const pageSettleProps = IS_WEB")
    expect(CARD).toContain(
      "? { onScroll: onPageSettled, scrollEventThrottle: WEB_PAGE_SCROLL_THROTTLE_MS }",
    )
    expect(constant("WEB_PAGE_SCROLL_THROTTLE_MS")).toBeGreaterThanOrEqual(50)
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
    expect(CARD).not.toMatch(/width=\{`\$\{/)
    expect(CARD).not.toContain('width: "100%"')
  })

  it("plots the daily sign-ups as bars with weekly labels, not a smear of days", () => {
    expect(CARD).toContain("xLabels={weeklyXLabels(daily, weekLabel)}")
    expect(CARD).toContain("<ProgressRing")
    expect(CARD.match(/<BarChart/g) ?? [], "sign-ups per day and hours per event").toHaveLength(2)
  })

  it("keeps the hours bars distinct when two events carry the same title", () => {
    expect(CARD).toContain("bars={rows.map((row, index) => ({")
    expect(CARD).toContain("key: `${index}:${row.key}`,")
    expect(BAR_CHART).toContain("<View key={bar.key} style={styles.row}>")
  })

  it("lists the impact numbers as labelled rows rather than mixed-unit bars", () => {
    expect(CARD).toContain("summaryImpactRows(data.activity)")
    expect(CARD).toContain("function StatRows({ rows }")
    expect(CARD).not.toContain("card.impact_bars_a11y")
  })

  it("shapes the empty states like an axis rather than a sentence", () => {
    expect(CARD).toContain("function EmptyChart({ width, label }")
    expect(CARD).toContain("series={FLAT_SERIES}")
    expect(CARD.match(/<EmptyChart/g) ?? [], "sign-ups and hours").toHaveLength(2)
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
  })
})

describe("the page dots are real targets on web, where hitSlop does nothing", () => {
  it("wraps each 6 px dot in a pressable at least 24 px square", () => {
    expect(constant("DOT_SIZE")).toBe(6)
    expect(constant("DOT_TARGET")).toBeGreaterThanOrEqual(24)
    expect(CARD).toMatch(/dotTarget: \{\n\s+width: DOT_TARGET,\n\s+height: DOT_TARGET,/)
    expect(CARD).toContain("style={styles.dotTarget}")
    expect(CARD).toContain("<View style={[styles.dot, dot === index ? styles.dotOn : null]} />")
  })

  it("still reaches 44 px on native without letting neighbouring dots overlap", () => {
    expect(expectThemeTouchTarget(CARD)).toBe(44)
    expect(CARD).toContain("const DOT_SLOP_Y = (MIN_TOUCH_TARGET - DOT_TARGET) / 2")
    expect(CARD).toContain("const DOT_HIT_SLOP = { top: DOT_SLOP_Y, bottom: DOT_SLOP_Y }")
    expect(CARD).not.toContain("hitSlop={8}")
  })
})
