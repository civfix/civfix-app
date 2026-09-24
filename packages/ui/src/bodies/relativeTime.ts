import { relativeAgo, EDIT_WINDOW_HOURS, MS_PER_HOUR, type RelativeUnitLabels } from "@civfix/shared"

export interface ListTimeAgoOptions {
  justNow?: string
  units?: Partial<RelativeUnitLabels>
  locale?: string
}

export function listTimeAgo(iso: string, opts: ListTimeAgoOptions = {}): string {
  return relativeAgo(iso, undefined, {
    ...(opts.justNow ? { justNow: opts.justNow } : null),
    ...(opts.units ? { units: opts.units } : null),
    absoluteFallback: (d) => d.toLocaleDateString(opts.locale, { month: "short", day: "numeric" }),
  })
}

export function distanceLabel(dist: number | null | undefined, locale = "en"): string {
  if (dist == null || Number.isNaN(dist)) return ""
  const digits = dist < 10 ? 1 : 0
  const value = dist.toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: false,
  })
  return `${value} mi`
}

export function clockTime(iso: string, locale?: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })
}

export function focalTimestamp(iso: string, locale?: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const date = d.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" })
  return `${clockTime(iso, locale)} · ${date}`
}

function dayKeyOf(d: Date): string {
  const month = `${d.getMonth() + 1}`.padStart(2, "0")
  const day = `${d.getDate()}`.padStart(2, "0")
  return `${d.getFullYear()}-${month}-${day}`
}

export function dayKey(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return dayKeyOf(d)
}

export function todayKey(now: Date = new Date()): string {
  return dayKeyOf(now)
}

function shiftDayKey(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number)
  if (year === undefined || month === undefined || day === undefined) return ""
  return dayKeyOf(new Date(year, month - 1, day + days))
}

export interface DayLabelOptions {
  today?: string
  yesterday?: string
  locale?: string
  now?: string
}

export function dayLabel(iso: string, opts: DayLabelOptions = {}): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const reference = opts.now || todayKey()
  const key = dayKeyOf(d)
  if (key === reference) return opts.today ?? "Today"
  if (key === shiftDayKey(reference, -1)) return opts.yesterday ?? "Yesterday"
  const sameYear = key.slice(0, 4) === reference.slice(0, 4)
  return d.toLocaleDateString(opts.locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  })
}

export function withinEditWindow(createdAt: string, now: Date = new Date()): boolean {
  const t = new Date(createdAt).getTime()
  if (Number.isNaN(t)) return false
  return now.getTime() - t < EDIT_WINDOW_HOURS * MS_PER_HOUR
}
