
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
