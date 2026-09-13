import { MIN_SLOT_DURATION_MINUTES } from "@civfix/shared"

export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6

const WEEK_START_FALLBACK: Record<string, WeekStart> = {
  en: 0,
  ko: 0,
  es: 1,
  de: 1,
}

function intlFirstDay(locale: string): number | null {
  try {
    const info = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number }
      weekInfo?: { firstDay: number }
    }
    return info.getWeekInfo?.().firstDay ?? info.weekInfo?.firstDay ?? null
  } catch {
    return null
  }
}

export function weekStartForLocale(locale: string): WeekStart {
  const firstDay = intlFirstDay(locale)
  if (typeof firstDay === "number" && firstDay >= 1 && firstDay <= 7) {
    return (firstDay === 7 ? 0 : firstDay) as WeekStart
  }
  const language = locale.split("-")[0]?.toLowerCase() ?? ""
  return WEEK_START_FALLBACK[language] ?? 0
}

export function rotateWeekdays<T>(sundayFirst: readonly T[], weekStart: WeekStart): T[] {
  if (weekStart === 0 || sundayFirst.length !== 7) return [...sundayFirst]
  return [...sundayFirst.slice(weekStart), ...sundayFirst.slice(0, weekStart)]
}

export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function monthGrid(year: number, month: number, weekStart: WeekStart = 0): (number | null)[] {
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const lead = (firstWeekday - weekStart + 7) % 7
  const cells: (number | null)[] = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) cells.push(day)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export interface TimeSlot {
  key: string
  label: string
  hours: number
  minutes: number
}

export function timeSlots(locale: string): TimeSlot[] {
  const out: TimeSlot[] = []
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const probe = new Date(2000, 0, 1)
      probe.setHours(h, m, 0, 0)
      out.push({
        key: `${h}:${m}`,
        label: probe.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" }),
        hours: h,
        minutes: m,
      })
    }
  }
  return out
}

export const PAST_SCHEDULE_GRACE_MS = 60_000

export function mergeDateTime(date: Date, time: Date): Date {
  const merged = new Date(date)
  merged.setHours(time.getHours(), time.getMinutes(), 0, 0)
  return merged
}

export function wallClockExistsOn(date: Date, hours: number, minutes: number): boolean {
  const probe = new Date(date)
  probe.setHours(hours, minutes, 0, 0)
  return probe.getHours() === hours && probe.getMinutes() === minutes
}

export function isTimeSlotSelectable(
  date: Date | null,
  hours: number,
  minutes: number,
  now: Date,
): boolean {
  if (!date) return true
  if (!wallClockExistsOn(date, hours, minutes)) return false
  const probe = new Date(date)
  probe.setHours(hours, minutes, 0, 0)
  return probe.getTime() > now.getTime() - PAST_SCHEDULE_GRACE_MS
}

export function isScheduleInFuture(date: Date, time: Date, now: Date = new Date()): boolean {
  return mergeDateTime(date, time).getTime() > now.getTime() - PAST_SCHEDULE_GRACE_MS
}

export function isScheduleUntouched(originalIso: string, date: Date, time: Date): boolean {
  const original = new Date(originalIso).getTime()
  return date.getTime() === original && time.getTime() === original
}

export const MIN_SLOT_DURATION_MS = MIN_SLOT_DURATION_MINUTES * 60_000

export const MAX_EVENT_DURATION_MS = 24 * 3_600_000

export const DURATION_CHIP_HOURS = [1, 2, 3, 4] as const

export type DurationChipHours = (typeof DURATION_CHIP_HOURS)[number]

function clockOf(hours: number, minutes: number): number {
  return hours * 3_600_000 + minutes * 60_000
}

function clockMs(time: Date): number {
  return clockOf(time.getHours(), time.getMinutes())
}

function offsetFromClocks(startClock: number, endClock: number): number {
  return (((endClock - startClock) % MAX_EVENT_DURATION_MS) + MAX_EVENT_DURATION_MS) %
    MAX_EVENT_DURATION_MS
}

export function endOffsetMs(start: Date, end: Date): number {
  return offsetFromClocks(clockMs(start), clockMs(end))
}

export function endsNextDay(start: Date, end: Date): boolean {
  return clockMs(end) <= clockMs(start)
}

export function resolveEventEnd(date: Date, start: Date, end: Date): Date {
  const day = new Date(date)
  if (endsNextDay(start, end)) day.setDate(day.getDate() + 1)
  return mergeDateTime(day, end)
}

export function endTimeAfter(date: Date, start: Date, offsetMs: number): Date {
  const clock = offsetFromClocks(0, clockMs(start) + offsetMs)
  const day = new Date(date)
  day.setHours(Math.floor(clock / 3_600_000), Math.floor((clock % 3_600_000) / 60_000), 0, 0)
  return day
}

export function endTimeSelectable(
  date: Date | null,
  start: Date | null,
  hours: number,
  minutes: number,
): boolean {
  if (!date || !start) return false
  const offset = offsetFromClocks(clockMs(start), clockOf(hours, minutes))
  if (offset < MIN_SLOT_DURATION_MS) return false
  const day = new Date(date)
  if (clockOf(hours, minutes) <= clockMs(start)) day.setDate(day.getDate() + 1)
  return wallClockExistsOn(day, hours, minutes)
}

export function eventDurationMs(date: Date, start: Date, end: Date): number {
  return resolveEventEnd(date, start, end).getTime() - mergeDateTime(date, start).getTime()
}

export function durationChipFor(
  date: Date | null,
  start: Date | null,
  end: Date | null,
): DurationChipHours | null {
  if (!date || !start || !end) return null
  const elapsed = eventDurationMs(date, start, end)
  if (elapsed <= 0) return null
  return DURATION_CHIP_HOURS.find((h) => h * 3_600_000 === elapsed) ?? null
}

export function eventWindowOf(
  date: Date | null,
  time: Date | null,
  endTime: Date | null,
): { start: Date; end: Date | null } | null {
  if (!date || !time) return null
  return {
    start: mergeDateTime(date, time),
    end: endTime ? resolveEventEnd(date, time, endTime) : null,
  }
}
