import { intOr } from "../internal/numbers.js"
import { MS_PER_DAY } from "../time-units.js"
import { K_SUPPRESS, normalizeK, roundRate, safeCount } from "./counts.js"

export const MAX_SERIES_DAYS = 400
export const MAX_ARRIVAL_BUCKETS = 200

const DEFAULT_ARRIVAL_BUCKET_MINUTES = 15
const DEFAULT_ARRIVAL_FROM_MINUTES = -120
const DEFAULT_ARRIVAL_TO_MINUTES = 240

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

export interface DayRange {
  from: string
  to: string
}

export interface DayCount {
  day: string
  count: number
}

export interface HourCount {
  hour: number
  count: number
}

export interface KeyCount {
  key: string
  count: number
}

export interface DayTimeCount {
  weekday: number
  hour: number
  count: number
}

export interface DerivedSeriesPoint {
  day: string
  value: number | null
  suppressed: boolean
}

export interface DerivedHourPoint {
  hour: number
  value: number | null
  suppressed: boolean
}

export interface DerivedBreakdownRow {
  key: string
  value: number | null
  share: number | null
  suppressed: boolean
}

export interface DerivedFunnelStep {
  key: string
  value: number | null
  conversionFromFirst: number | null
  suppressed: boolean
}

export interface DerivedArrivalBucket {
  offsetMinutes: number
  value: number | null
  suppressed: boolean
}

export interface DerivedBestDayTime {
  weekday: number
  hour: number
  value: number
}

export interface DerivedPanel<Row> {
  panelSuppressed: boolean
  total: number | null
  rows: Row[]
}

export interface DerivedSeriesPanel {
  panelSuppressed: boolean
  total: number | null
  points: DerivedSeriesPoint[]
}

export interface SeriesClosure {
  panelSuppressed: boolean
  total: number
  totalPublishable: boolean
  daily: DerivedSeriesPoint[]
  cumulative: DerivedSeriesPoint[]
}

export interface DerivedHourPanel {
  panelSuppressed: boolean
  total: number | null
  points: DerivedHourPoint[]
}

export interface SuppressOptions {
  k?: number
  suppressPoints?: boolean
}

export interface BreakdownOptions {
  k?: number
  totalPublishable?: boolean
}

export interface BreakdownClosure {
  panelSuppressed: boolean
  total: number
  totalPublishable: boolean
  rows: DerivedBreakdownRow[]
}

export interface ArrivalsCurveOptions extends SuppressOptions {
  bucketMinutes?: number
  fromMinutes?: number
  toMinutes?: number
}

function dayToUtcMs(day: string): number {
  if (!DAY_RE.test(day)) return Number.NaN
  const year = Number(day.slice(0, 4))
  const month = Number(day.slice(5, 7))
  const date = Number(day.slice(8, 10))
  if (month < 1 || month > 12 || date < 1 || date > 31) return Number.NaN
  const ms = Date.UTC(year, month - 1, date)
  return utcMsToDay(ms) === day ? ms : Number.NaN
}

function utcMsToDay(ms: number): string {
  const d = new Date(ms)
  const year = String(d.getUTCFullYear()).padStart(4, "0")
  const month = String(d.getUTCMonth() + 1).padStart(2, "0")
  const date = String(d.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${date}`
}

export function enumerateDays(range: DayRange): string[] {
  const from = dayToUtcMs(range.from)
  const to = dayToUtcMs(range.to)
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    throw new RangeError("enumerateDays expects YYYY-MM-DD calendar days")
  }
  if (to < from) throw new RangeError("enumerateDays expects range.from <= range.to")
  const span = Math.round((to - from) / MS_PER_DAY) + 1
  if (span > MAX_SERIES_DAYS) {
    throw new RangeError(`enumerateDays refuses an unbounded range (${span} days > ${MAX_SERIES_DAYS})`)
  }
  const days: string[] = []
  for (let i = 0; i < span; i++) days.push(utcMsToDay(from + i * MS_PER_DAY))
  return days
}

function totalsByKey(rows: readonly { key: string; count: number }[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const row of rows) {
    if (typeof row.key !== "string" || row.key.length === 0) continue
    totals.set(row.key, (totals.get(row.key) ?? 0) + safeCount(row.count))
  }
  return totals
}

function groupRevealable(hiddenCount: number, hiddenMass: number, k: number): boolean {
  if (hiddenMass === 0) return true
  if (hiddenCount < 2) return false
  return hiddenMass >= k - 1 && hiddenMass <= (hiddenCount - 1) * (k - 1)
}

function hiddenGroupOf(values: readonly number[], k: number): { count: number; mass: number } {
  let count = 0
  let mass = 0
  for (const value of values) {
    if (value >= k) continue
    count += 1
    mass += value
  }
  return { count, mass }
}

function secondarySuppression(values: readonly number[], k: number): boolean[] {
  const hidden = values.map((value) => value < k)
  let count = 0
  let mass = 0
  values.forEach((value, index) => {
    if (hidden[index] === true) {
      count += 1
      mass += value
    }
  })
  const shown = values
    .map((value, index) => ({ value, index }))
    .filter((entry) => hidden[entry.index] !== true)
    .sort((a, b) => a.value - b.value || a.index - b.index)
  let next = 0
  while (!groupRevealable(count, mass, k) && next < shown.length) {
    const entry = shown[next]
    if (entry === undefined) break
    hidden[entry.index] = true
    count += 1
    mass += entry.value
    next += 1
  }
  return hidden
}

function bucketByDay(points: readonly DayCount[], days: readonly string[]): Map<string, number> {
  const within = new Set(days)
  const byDay = new Map<string, number>()
  for (const point of points) {
    if (!within.has(point.day)) continue
    byDay.set(point.day, (byDay.get(point.day) ?? 0) + safeCount(point.count))
  }
  return byDay
}

export function seriesClosure(
  points: readonly DayCount[],
  range: DayRange,
  options: SuppressOptions = {},
): SeriesClosure {
  const k = normalizeK(options.k)
  const days = enumerateDays(range)
  const byDay = bucketByDay(points, days)
  const values = days.map((day) => byDay.get(day) ?? 0)
  let total = 0
  for (const value of values) total += value
  const panelSuppressed = total < k
  const suppressPoints = options.suppressPoints === true
  const all = hiddenGroupOf(values, k)

  const shown: boolean[] = []
  const running: number[] = []
  let sum = 0
  let lastShown = 0
  let seenCount = 0
  let seenMass = 0
  let groupCount = 0
  let groupMass = 0
  for (const value of values) {
    sum += value
    running.push(sum)
    if (value < k) {
      groupCount += 1
      groupMass += value
      seenCount += 1
      seenMass += value
    }
    const delta = sum - lastShown
    const publish =
      !panelSuppressed &&
      (delta === 0 || delta >= k) &&
      groupRevealable(groupCount, groupMass, k) &&
      groupRevealable(all.count - seenCount, all.mass - seenMass, k)
    shown.push(publish)
    if (publish) {
      lastShown = sum
      groupCount = 0
      groupMass = 0
    }
  }

  const totalPublishable = !panelSuppressed && groupRevealable(groupCount, groupMass, k)
  if (totalPublishable && days.length > 0) shown[days.length - 1] = true

  return {
    panelSuppressed,
    total,
    totalPublishable,
    daily: days.map((day, index) => {
      const value = values[index] ?? 0
      const suppressed = panelSuppressed || (suppressPoints && value < k)
      return { day, value: suppressed ? null : value, suppressed }
    }),
    cumulative: days.map((day, index) => {
      const suppressed = shown[index] !== true
      return { day, value: suppressed ? null : (running[index] ?? 0), suppressed }
    }),
  }
}

export function dailySeries(
  points: readonly DayCount[],
  range: DayRange,
  options: SuppressOptions = {},
): DerivedSeriesPanel {
  const closure = seriesClosure(points, range, options)
  const gated = options.suppressPoints === true && !closure.totalPublishable
  return {
    panelSuppressed: closure.panelSuppressed,
    total: closure.panelSuppressed || gated ? null : closure.total,
    points: closure.daily,
  }
}

export function breakdownClosure(
  rows: readonly KeyCount[],
  options: BreakdownOptions = {},
): BreakdownClosure {
  const k = normalizeK(options.k)
  const totals = totalsByKey(rows)
  let total = 0
  for (const value of totals.values()) total += value
  const ordered = [...totals.entries()].sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
  const totalPublishable = options.totalPublishable !== false && total >= k
  const values = ordered.map(([, value]) => value)
  const hidden = totalPublishable ? secondarySuppression(values, k) : values.map(() => true)
  const panelSuppressed = hidden.every((row) => row === true)
  if (panelSuppressed) return { panelSuppressed, total, totalPublishable, rows: [] }
  return {
    panelSuppressed,
    total,
    totalPublishable,
    rows: ordered.map(([key, value], index) => {
      const suppressed = hidden[index] !== false
      return {
        key,
        value: suppressed ? null : value,
        share: suppressed || total === 0 ? null : roundRate(value / total),
        suppressed,
      }
    }),
  }
}

export function breakdown(rows: readonly KeyCount[], options: BreakdownOptions = {}): DerivedPanel<DerivedBreakdownRow> {
  const closure = breakdownClosure(rows, options)
  return {
    panelSuppressed: closure.panelSuppressed,
    total: closure.totalPublishable ? closure.total : null,
    rows: closure.rows,
  }
}

export function funnel(steps: readonly KeyCount[], options: SuppressOptions = {}): DerivedPanel<DerivedFunnelStep> {
  const k = normalizeK(options.k)
  const monotonic: { key: string; count: number }[] = []
  let ceiling = Number.POSITIVE_INFINITY
  for (const step of steps) {
    if (typeof step.key !== "string" || step.key.length === 0) continue
    const value = Math.min(safeCount(step.count), ceiling)
    ceiling = value
    monotonic.push({ key: step.key, count: value })
  }
  const first = monotonic[0]?.count ?? 0
  const panelSuppressed = first < k
  return {
    panelSuppressed,
    total: panelSuppressed ? null : first,
    rows: monotonic.map((step) => ({
      key: step.key,
      value: panelSuppressed ? null : step.count,
      conversionFromFirst: panelSuppressed || first === 0 ? null : roundRate(step.count / first),
      suppressed: panelSuppressed,
    })),
  }
}

export function arrivalsCurve(
  offsetsMinutes: readonly number[],
  options: ArrivalsCurveOptions = {},
): DerivedPanel<DerivedArrivalBucket> {
  const k = normalizeK(options.k)
  const bucket = intOr(options.bucketMinutes, 1, DEFAULT_ARRIVAL_BUCKET_MINUTES)
  const from = intOr(options.fromMinutes, Number.NEGATIVE_INFINITY, DEFAULT_ARRIVAL_FROM_MINUTES)
  const to = intOr(options.toMinutes, Number.NEGATIVE_INFINITY, DEFAULT_ARRIVAL_TO_MINUTES)
  if (to <= from) throw new RangeError("arrivalsCurve expects fromMinutes < toMinutes")
  const bucketCount = Math.ceil((to - from) / bucket)
  if (bucketCount > MAX_ARRIVAL_BUCKETS) {
    throw new RangeError(`arrivalsCurve refuses ${bucketCount} buckets (max ${MAX_ARRIVAL_BUCKETS})`)
  }
  const counts = new Array<number>(bucketCount).fill(0)
  for (const offset of offsetsMinutes) {
    if (!Number.isFinite(offset)) continue
    const clamped = Math.min(Math.max(offset, from), to - 1e-9)
    const index = Math.min(bucketCount - 1, Math.max(0, Math.floor((clamped - from) / bucket)))
    counts[index] = (counts[index] ?? 0) + 1
  }
  const total = counts.reduce((sum, value) => sum + value, 0)
  const panelSuppressed = total < k
  const suppressPoints = options.suppressPoints === true
  const hidden = suppressPoints ? hiddenGroupOf(counts, k) : { count: 0, mass: 0 }
  const totalPublishable = !panelSuppressed && groupRevealable(hidden.count, hidden.mass, k)
  return {
    panelSuppressed,
    total: totalPublishable ? total : null,
    rows: counts.map((value, index) => {
      const suppressed = panelSuppressed || (suppressPoints && value < k)
      return {
        offsetMinutes: from + index * bucket,
        value: suppressed ? null : value,
        suppressed,
      }
    }),
  }
}

export function bestDayTime(cells: readonly DayTimeCount[], k: number = K_SUPPRESS): DerivedBestDayTime | null {
  const threshold = normalizeK(k)
  const totals = new Map<string, number>()
  for (const cell of cells) {
    if (!Number.isInteger(cell.weekday) || cell.weekday < 0 || cell.weekday > 6) continue
    if (!Number.isInteger(cell.hour) || cell.hour < 0 || cell.hour > 23) continue
    const key = `${cell.weekday}:${cell.hour}`
    totals.set(key, (totals.get(key) ?? 0) + safeCount(cell.count))
  }
  let best: DerivedBestDayTime | null = null
  for (let weekday = 0; weekday <= 6; weekday++) {
    for (let hour = 0; hour <= 23; hour++) {
      const value = totals.get(`${weekday}:${hour}`) ?? 0
      if (best === null || value > best.value) best = { weekday, hour, value }
    }
  }
  if (best === null || best.value < threshold) return null
  return best
}
