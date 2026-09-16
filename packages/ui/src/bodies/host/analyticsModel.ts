import type {
  EventAnalyticsLifecycle,
  EventAnalyticsPhase,
  FunnelStep,
  GetEventAnalyticsResponse,
  SeriesPoint,
  SuppressedRate,
} from "@civfix/shared"
import { EVENT_ANALYTICS_COMPARISON_MIN_EVENTS } from "@civfix/shared"

export const ANALYTICS_PANELS = ["signups", "reach", "slots", "checkins", "impact"] as const

export type AnalyticsPanelKey = (typeof ANALYTICS_PANELS)[number]

const PANEL_ORDER: Readonly<Record<EventAnalyticsPhase, readonly AnalyticsPanelKey[]>> = {
  upcoming: ["signups", "reach", "slots", "checkins", "impact"],
  day_of: ["checkins", "signups", "slots", "reach", "impact"],
  completed: ["impact", "checkins", "signups", "reach", "slots"],
  archived: ["impact", "checkins", "signups", "reach", "slots"],
}

export const ARCHIVAL_AFTER_DAYS = 30

export const EVENT_DAY_PAD_MS = 2 * 3_600_000

export const FOLLOW_UP_DAYS = 30

export const DAY_MS = 86_400_000

export const REACH_RATE_MIN_VIEWS = 20

export function analyticsPanelOrder(phase: EventAnalyticsPhase): readonly AnalyticsPanelKey[] {
  return PANEL_ORDER[phase]
}

export function slotsPanelVisible(data: GetEventAnalyticsResponse): boolean {
  const rows = data.signups.bySlot?.rows.length ?? 0
  return rows > 0 || (data.kpis.capacity ?? 0) > 0
}

export function visibleAnalyticsPanels(
  data: GetEventAnalyticsResponse,
): readonly AnalyticsPanelKey[] {
  const order = analyticsPanelOrder(data.phase)
  return slotsPanelVisible(data) ? order : order.filter((panel) => panel !== "slots")
}

export function isArchivalEvent(
  lifecycle: EventAnalyticsLifecycle,
  phase: EventAnalyticsPhase,
  now: number,
): boolean {
  if (phase === "archived") return true
  if (phase !== "completed") return false
  const ended = Date.parse(lifecycle.completedAt ?? lifecycle.endAt ?? "")
  if (!Number.isFinite(ended)) return false
  return now - ended > ARCHIVAL_AFTER_DAYS * DAY_MS
}

export const LIFECYCLE_SEGMENTS = ["lead_up", "event_day", "follow_up", "all"] as const

export type LifecycleSegment = (typeof LIFECYCLE_SEGMENTS)[number]

export interface TimeRange {
  from: number
  to: number
}

function parse(value: string | null | undefined): number | null {
  if (!value) return null
  const at = Date.parse(value)
  return Number.isFinite(at) ? at : null
}

export function segmentRange(
  segment: LifecycleSegment,
  lifecycle: EventAnalyticsLifecycle,
  now: number,
): TimeRange {
  const created = parse(lifecycle.createdAt) ?? now
  const start = parse(lifecycle.startAt)
  const end = parse(lifecycle.endAt) ?? start
  if (segment === "lead_up") return { from: created, to: start ?? now }
  if (segment === "event_day" && start !== null) {
    return { from: start - EVENT_DAY_PAD_MS, to: (end ?? start) + EVENT_DAY_PAD_MS }
  }
  if (segment === "follow_up" && end !== null) {
    return { from: end, to: Math.min(now, end + FOLLOW_UP_DAYS * DAY_MS) }
  }
  return { from: created, to: now }
}

export function segmentEnabled(
  segment: LifecycleSegment,
  lifecycle: EventAnalyticsLifecycle,
  now: number,
): boolean {
  const start = parse(lifecycle.startAt)
  const end = parse(lifecycle.endAt) ?? start
  if (segment === "all") return true
  if (segment === "lead_up") return start !== null
  if (segment === "event_day") return start !== null && now >= start - EVENT_DAY_PAD_MS
  return end !== null && now >= end
}

export function defaultSegment(
  phase: EventAnalyticsPhase,
  lifecycle: EventAnalyticsLifecycle,
  now: number,
): LifecycleSegment {
  const wanted: LifecycleSegment =
    phase === "day_of" ? "event_day" : phase === "upcoming" ? "lead_up" : "follow_up"
  return segmentEnabled(wanted, lifecycle, now) ? wanted : "all"
}

const DAY_BUCKET_KEY = /^\d{4}-\d{2}-\d{2}$/

export function dayBucketed(points: readonly SeriesPoint[]): boolean {
  return points.length > 0 && points.every((point) => DAY_BUCKET_KEY.test(point.day))
}

export function wholeDayRange(range: TimeRange): TimeRange {
  return {
    from: Math.floor(range.from / DAY_MS) * DAY_MS,
    to: Math.floor(range.to / DAY_MS) * DAY_MS + DAY_MS - 1,
  }
}

export function sliceSeries(
  points: readonly SeriesPoint[],
  range: TimeRange,
): readonly SeriesPoint[] {
  const bounds = dayBucketed(points) ? wholeDayRange(range) : range
  const sliced = points.filter((point) => {
    const at = parse(point.day)
    return at === null ? true : at >= bounds.from && at <= bounds.to
  })
  return sliced.length > 0 ? sliced : points
}

export function seriesValues(points: readonly SeriesPoint[]): (number | null)[] {
  return points.map((point) => (point.suppressed ? null : point.value))
}

export function seriesPoints(points: readonly SeriesPoint[]): { x: number; y: number | null }[] {
  return points.map((point, index) => ({
    x: parse(point.day) ?? index,
    y: point.suppressed ? null : point.value,
  }))
}

export function hasSeriesData(points: readonly SeriesPoint[]): boolean {
  return points.some((point) => !point.suppressed && (point.value ?? 0) > 0)
}

export function ratePercent(rate: SuppressedRate | undefined): number | null {
  if (!rate || rate.suppressed || rate.value === null) return null
  return Math.round(rate.value * 100)
}

export function reachRateVisible(pageViews: number | null, rate: SuppressedRate): boolean {
  return (pageViews ?? 0) >= REACH_RATE_MIN_VIEWS && ratePercent(rate) !== null
}

export interface FunnelBar {
  step: string
  value: number | null
  fraction: number
  ofPrevious: number | null
  ghost: boolean
}

export function funnelBars(steps: readonly FunnelStep[]): FunnelBar[] {
  const top = steps.find((step) => step.value !== null && !step.suppressed)?.value ?? 0
  let previous: number | null = null
  return steps.map((step) => {
    const value = step.suppressed ? null : step.value
    const fraction = value === null || top <= 0 ? 0 : Math.min(1, value / top)
    const ofPrevious =
      value === null || previous === null || previous <= 0
        ? null
        : Math.round((value / previous) * 100)
    const ghost = value === null || value === 0
    previous = value
    return { step: step.step, value, fraction, ofPrevious, ghost }
  })
}

export function comparisonVisible(data: GetEventAnalyticsResponse): boolean {
  const sample = data.comparison?.sampleSize ?? 0
  return sample >= EVENT_ANALYTICS_COMPARISON_MIN_EVENTS
}

export type ComparisonVerdict = "above" | "typical" | "below" | "unknown"

export const COMPARISON_BAND = 0.1

export function comparisonVerdict(
  value: number | null,
  median: number | null,
): ComparisonVerdict {
  if (value === null || median === null || median <= 0) return "unknown"
  const delta = (value - median) / median
  if (delta > COMPARISON_BAND) return "above"
  if (delta < -COMPARISON_BAND) return "below"
  return "typical"
}
