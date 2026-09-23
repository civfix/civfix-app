import type {
  BreakdownRow,
  FunnelStep,
  GetEventAnalyticsResponse,
  HostAnalyticsSummaryActivity,
  HostedEventDTO,
  SeriesPoint,
  SuppressedRate,
} from "@civfix/shared"
import { EVENT_ANALYTICS_COMPARISON_MIN_EVENTS } from "@civfix/shared"
import { hostedEventCan } from "./dashboard/dashboardModel"

export const SUMMARY_PANELS = ["signups", "checkins", "hours", "impact"] as const

export type SummaryPanelKey = (typeof SUMMARY_PANELS)[number]

export const DAY_MS = 86_400_000

const DAY_BUCKET_KEY = /^\d{4}-\d{2}-\d{2}/

function parse(value: string | null | undefined): number | null {
  if (!value || !DAY_BUCKET_KEY.test(value)) return null
  const at = Date.parse(value)
  return Number.isFinite(at) ? at : null
}

export const ANALYTICS_RANGE_PRESETS = ["whole_event", "7d", "30d", "90d", "all"] as const

export type AnalyticsRangePreset = (typeof ANALYTICS_RANGE_PRESETS)[number]

export const ALL_EVENTS_RANGE_PRESETS = ["7d", "30d", "90d", "all"] as const

export const DEFAULT_ALL_EVENTS_PRESET: AnalyticsRangePreset = "30d"

export const DEFAULT_EVENT_PRESET: AnalyticsRangePreset = "whole_event"

const PRESET_DAYS: Readonly<Record<AnalyticsRangePreset, number | null>> = {
  whole_event: null,
  "7d": 7,
  "30d": 30,
  "90d": 90,
  all: null,
}

export function presetDays(preset: AnalyticsRangePreset): number | null {
  return PRESET_DAYS[preset]
}

export function rangeSlice(
  points: readonly SeriesPoint[],
  days: number | null,
  now: number,
): readonly SeriesPoint[] {
  if (days === null || days <= 0) return points
  const from = Math.floor(now / DAY_MS) * DAY_MS - (days - 1) * DAY_MS
  return points.filter((point) => {
    const at = parse(point.day)
    return at === null ? true : at >= from
  })
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

export const CARD_SLOT_ROWS = 4

export function busiestRows(rows: readonly BreakdownRow[], max = CARD_SLOT_ROWS): BreakdownRow[] {
  if (max <= 0) return []
  return [...rows]
    .sort((a, b) => (b.suppressed ? -1 : (b.value ?? 0)) - (a.suppressed ? -1 : (a.value ?? 0)))
    .slice(0, max)
}

const ISO_WEEK_START = 1

export function weeklyXLabels(
  points: readonly SeriesPoint[],
  label: (day: string) => string,
): { index: number; text: string }[] {
  const out: { index: number; text: string }[] = []
  points.forEach((point, index) => {
    const at = parse(point.day)
    if (at === null) return
    if (new Date(at).getUTCDay() !== ISO_WEEK_START) return
    out.push({ index, text: label(point.day) })
  })
  return out
}

const WEEK_LABEL_FORMAT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  // Day keys are plain calendar dates that `new Date(key)` reads as UTC midnight; formatting that
  // instant in the viewer's zone shows the previous day everywhere west of UTC.
  timeZone: "UTC",
}

export function weekDayLabel(locale: string): (day: string) => string {
  let format: Intl.DateTimeFormat
  try {
    format = new Intl.DateTimeFormat(locale, WEEK_LABEL_FORMAT)
  } catch {
    format = new Intl.DateTimeFormat(undefined, WEEK_LABEL_FORMAT)
  }
  return (day: string) => format.format(new Date(day))
}

export const ARRIVAL_LABEL_MINUTES = [-60, 0, 60, 120] as const

const MINUTE_BUCKET = /^-?\d+$/

export function arrivalXLabels(
  points: readonly SeriesPoint[],
  label: (minutes: number) => string,
): { index: number; text: string }[] {
  const out: { index: number; text: string }[] = []
  for (const minutes of ARRIVAL_LABEL_MINUTES) {
    const index = points.findIndex(
      (point) => MINUTE_BUCKET.test(point.day) && Number(point.day) === minutes,
    )
    if (index >= 0) out.push({ index, text: label(minutes) })
  }
  return out
}

export interface SummaryImpactRow {
  key: "resolved" | "posts" | "donations"
  value: number
}

export function summaryImpactRows(activity: HostAnalyticsSummaryActivity): SummaryImpactRow[] {
  const rows: SummaryImpactRow[] = [
    { key: "resolved", value: activity.reportsResolved },
    { key: "posts", value: activity.postsCreated },
  ]
  if (activity.donationClicks > 0) rows.push({ key: "donations", value: activity.donationClicks })
  return rows
}

export interface AnalyticsPickerOption {
  id: string
  title: string
}

export function pickerOptions(
  upcoming: readonly HostedEventDTO[],
  past: readonly HostedEventDTO[],
): AnalyticsPickerOption[] {
  const seen = new Set<string>()
  return [...upcoming, ...past]
    .filter((event) => hostedEventCan(event, "view_analytics"))
    .filter((event) => (seen.has(event.id) ? false : (seen.add(event.id), true)))
    .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))
    .map((event) => ({ id: event.id, title: event.title }))
}

const EVENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isEventId(key: string): boolean {
  return EVENT_ID.test(key)
}

export function eventRowTarget(
  row: BreakdownRow,
  options: readonly AnalyticsPickerOption[],
): AnalyticsPickerOption | null {
  if (isEventId(row.key)) {
    const known = options.find((option) => option.id === row.key)
    return { id: row.key, title: known?.title ?? row.label }
  }
  const byTitle = options.find(
    (option) => option.title === row.label || option.title === row.key,
  )
  return byTitle === undefined ? null : { id: byTitle.id, title: byTitle.title }
}

export function carouselPage(offsetX: number, pageWidth: number, pageCount: number): number {
  if (!Number.isFinite(offsetX) || !Number.isFinite(pageWidth) || pageWidth <= 0) return 0
  const last = Math.max(0, pageCount - 1)
  const page = Math.round(offsetX / pageWidth)
  return page <= 0 ? 0 : page > last ? last : page
}

export function ratePercent(rate: SuppressedRate | undefined): number | null {
  if (!rate || rate.suppressed || rate.value === null) return null
  return Math.round(rate.value * 100)
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

export const FUNNEL_SIGNUPS_STEP = "signups"

export const FUNNEL_CHECKED_IN_STEP = "checked_in"

export function funnelCount(steps: readonly FunnelStep[], step: string): number | null {
  const found = steps.find((entry) => entry.step === step)
  return found === undefined || found.suppressed ? null : found.value
}

export function wholeEventSignups(data: GetEventAnalyticsResponse): number | null {
  return data.kpis.signups ?? funnelCount(data.reach.funnel, FUNNEL_SIGNUPS_STEP)
}

export function wholeEventCheckedIn(data: GetEventAnalyticsResponse): number | null {
  return data.kpis.checkedIn ?? funnelCount(data.reach.funnel, FUNNEL_CHECKED_IN_STEP)
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
