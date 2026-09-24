import { MIN_EVENT_DURATION_MINUTES, MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE } from "@civfix/shared"
import {
  wallClockExistsInZone,
  wallClockInZone,
  wallClockToInstantMs,
  zoneShortName,
  type WallClock,
} from "@civfix/shared/datetime"

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

export const PAST_SCHEDULE_GRACE_MS = MS_PER_MINUTE

export function mergeDateTime(date: Date, time: Date): Date {
  const merged = new Date(date)
  merged.setHours(time.getHours(), time.getMinutes(), 0, 0)
  return merged
}

const DRAFT_WHEN_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
}

/** The host form's own one-line "when" for a draft, in the device zone the form's pickers use. */
export function draftWhenLabel(at: Date, locale: string): string {
  return at.toLocaleString(locale, DRAFT_WHEN_FORMAT)
}

export function isScheduleUntouched(
  originalIso: string,
  date: Date,
  time: Date,
  timeZone?: string,
): boolean {
  const original = new Date(originalIso).getTime()
  if (Number.isNaN(original)) return false
  if (timeZone === undefined) return date.getTime() === original && time.getTime() === original
  return formInstantMs(date, time, timeZone) === Math.floor(original / MS_PER_MINUTE) * MS_PER_MINUTE
}

const MIN_EVENT_DURATION_MS = MIN_EVENT_DURATION_MINUTES * MS_PER_MINUTE

export const DURATION_CHIP_HOURS = [1, 2, 3, 4] as const

export type DurationChipHours = (typeof DURATION_CHIP_HOURS)[number]

function clockOf(hours: number, minutes: number): number {
  return hours * MS_PER_HOUR + minutes * MS_PER_MINUTE
}

function clockMs(time: Date): number {
  return clockOf(time.getHours(), time.getMinutes())
}

function offsetFromClocks(startClock: number, endClock: number): number {
  return (((endClock - startClock) % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY
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
  day.setHours(Math.floor(clock / MS_PER_HOUR), Math.floor((clock % MS_PER_HOUR) / MS_PER_MINUTE), 0, 0)
  return day
}

/**
 * The end clock a duration chip sets: `offsetMs` of real time after the start, read in the event's zone so
 * the chip lands on the window `durationChipFor` measures (on a DST night "2 h" is two real hours, not two
 * wall-clock ones). A start that does not exist in the zone keeps the wall-clock sum.
 */
export function endTimeAfterInZone(date: Date, start: Date, offsetMs: number, timeZone: string): Date {
  const startMs = formInstantMs(date, start, timeZone)
  if (startMs === null) return endTimeAfter(date, start, offsetMs)
  const wall = wallClockInZone(startMs + offsetMs, timeZone)
  const end = new Date(date)
  end.setHours(wall.hours, wall.minutes, 0, 0)
  return end
}

export function endTimeSelectable(
  date: Date | null,
  start: Date | null,
  hours: number,
  minutes: number,
  timeZone: string,
): boolean {
  if (!date || !start) return false
  const offset = offsetFromClocks(clockMs(start), clockOf(hours, minutes))
  if (offset < MIN_EVENT_DURATION_MS) return false
  const day = new Date(date)
  if (clockOf(hours, minutes) <= clockMs(start)) day.setDate(day.getDate() + 1)
  return wallClockExistsInZone(
    { year: day.getFullYear(), month: day.getMonth() + 1, day: day.getDate(), hours, minutes },
    timeZone,
  )
}

/**
 * Real elapsed time between the start and end clocks. With `timeZone` the clocks are read in the EVENT's
 * zone, which is where the saved window lives; without it, in the device zone. NaN when either clock does
 * not exist in that zone (a DST gap).
 */
export function eventDurationMs(date: Date, start: Date, end: Date, timeZone?: string): number {
  if (timeZone === undefined) {
    return resolveEventEnd(date, start, end).getTime() - mergeDateTime(date, start).getTime()
  }
  const window = eventWindowInZone(date, start, end, timeZone)
  return window?.end ? window.end.getTime() - window.start.getTime() : Number.NaN
}

export function durationChipFor(
  date: Date | null,
  start: Date | null,
  end: Date | null,
  timeZone?: string,
): DurationChipHours | null {
  if (!date || !start || !end) return null
  const elapsed = eventDurationMs(date, start, end, timeZone)
  if (elapsed <= 0) return null
  return DURATION_CHIP_HOURS.find((h) => h * MS_PER_HOUR === elapsed) ?? null
}

function formWallClock(date: Date, time: Date): WallClock {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hours: time.getHours(),
    minutes: time.getMinutes(),
  }
}

export function wallClockToFormDate(wallClock: WallClock): Date {
  return new Date(
    wallClock.year,
    wallClock.month - 1,
    wallClock.day,
    wallClock.hours,
    wallClock.minutes,
    0,
    0,
  )
}

export function addWallClockDays(wallClock: WallClock, days: number): WallClock {
  const anchor = new Date(Date.UTC(wallClock.year, wallClock.month - 1, wallClock.day, 12))
  const moved = new Date(anchor.getTime() + days * MS_PER_DAY)
  return {
    year: moved.getUTCFullYear(),
    month: moved.getUTCMonth() + 1,
    day: moved.getUTCDate(),
    hours: wallClock.hours,
    minutes: wallClock.minutes,
  }
}

export function formInstantMs(date: Date, time: Date, timeZone: string): number | null {
  return wallClockToInstantMs(formWallClock(date, time), timeZone)
}

export function formEndInstantMs(
  date: Date,
  start: Date,
  end: Date,
  timeZone: string,
): number | null {
  const day = new Date(date)
  if (endsNextDay(start, end)) day.setDate(day.getDate() + 1)
  return formInstantMs(day, end, timeZone)
}

export function isScheduleInFutureInZone(
  date: Date,
  time: Date,
  timeZone: string,
  now: number = Date.now(),
): boolean {
  const instant = formInstantMs(date, time, timeZone)
  return instant !== null && instant > now - PAST_SCHEDULE_GRACE_MS
}

export function todayInZone(timeZone: string, now: number = Date.now()): Date {
  const wall = wallClockInZone(now, timeZone)
  return wallClockToFormDate({ ...wall, hours: 0, minutes: 0 })
}

export function nowClockInZone(timeZone: string, now: number = Date.now()): Date {
  return wallClockToFormDate(wallClockInZone(now, timeZone))
}

export function eventWindowInZone(
  date: Date | null,
  time: Date | null,
  endTime: Date | null,
  timeZone: string,
): { start: Date; end: Date | null } | null {
  if (!date || !time) return null
  const start = formInstantMs(date, time, timeZone)
  if (start === null) return null
  const end = endTime ? formEndInstantMs(date, time, endTime, timeZone) : null
  return { start: new Date(start), end: end === null ? null : new Date(end) }
}

export function uses24HourClock(locale: string): boolean {
  try {
    const resolved = new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions()
    if (typeof resolved.hour12 === "boolean") return !resolved.hour12
    return resolved.hourCycle === "h23" || resolved.hourCycle === "h24"
  } catch {
    return false
  }
}

export function zoneDisplayName(
  timeZone: string,
  locale: string,
  now: number = Date.now(),
): string {
  const short = zoneShortName(now, timeZone, locale)
  let long = ""
  try {
    const parts = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "long" }).formatToParts(
      new Date(now),
    )
    long = parts.find((p) => p.type === "timeZoneName")?.value ?? ""
  } catch {
    long = ""
  }
  if (long === "") return short === "" ? timeZone : short
  if (short === "" || short === long) return long
  return `${long} (${short})`
}

export interface ZoneDisplayNameCache {
  get: (timeZone: string, locale: string, now?: number) => string
  size: () => number
}

/**
 * Zone names for the current day only: a name carries the offset in force (PST vs PDT), which a DST change
 * moves, so a new day starts a fresh map rather than keeping every earlier day's entries for the app's life.
 */
export function makeZoneDisplayNameCache(): ZoneDisplayNameCache {
  let day: number | null = null
  const names = new Map<string, string>()
  return {
    get(timeZone, locale, now = Date.now()) {
      const today = Math.floor(now / MS_PER_DAY)
      if (today !== day) {
        names.clear()
        day = today
      }
      const key = `${locale}|${timeZone}`
      const cached = names.get(key)
      if (cached !== undefined) return cached
      const name = zoneDisplayName(timeZone, locale, now)
      names.set(key, name)
      return name
    },
    size: () => names.size,
  }
}

const WARM_CHUNK = 40

/**
 * Fills `cache` for every zone in timer-sliced chunks and returns a cancel. A display name costs two Intl
 * formatters, so the first timezone query that misses every id would otherwise build about 800 of them
 * inside a single keystroke.
 */
export function warmZoneDisplayNames(
  cache: ZoneDisplayNameCache,
  zones: readonly string[],
  locale: string,
): () => void {
  let index = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  const step = () => {
    const end = Math.min(index + WARM_CHUNK, zones.length)
    for (; index < end; index++) {
      const zone = zones[index]
      if (zone !== undefined) cache.get(zone, locale)
    }
    timer = index < zones.length ? setTimeout(step, 0) : null
  }
  timer = setTimeout(step, 0)
  return () => {
    if (timer !== null) clearTimeout(timer)
  }
}

export type ScheduleFieldErrorKey = "date_past" | "time_past" | "end_too_soon" | "time_dst_gap"

export interface ScheduleFieldErrors {
  date?: ScheduleFieldErrorKey
  time?: ScheduleFieldErrorKey
  endTime?: ScheduleFieldErrorKey
}

export interface ScheduleFieldInput {
  date: Date | null
  time: Date | null
  endTime: Date | null
}

export function scheduleFieldErrors(
  value: ScheduleFieldInput,
  timeZone: string,
  now: number = Date.now(),
): ScheduleFieldErrors {
  const errors: ScheduleFieldErrors = {}
  const { date, time, endTime } = value
  if (!date) return errors

  if (startOfDay(date).getTime() < todayInZone(timeZone, now).getTime()) errors.date = "date_past"

  if (time) {
    if (!wallClockExistsInZone(formWallClock(date, time), timeZone)) errors.time = "time_dst_gap"
    else if (!isScheduleInFutureInZone(date, time, timeZone, now)) errors.time = "time_past"
  }

  if (time && endTime) {
    const day = new Date(date)
    if (endsNextDay(time, endTime)) day.setDate(day.getDate() + 1)
    if (endOffsetMs(time, endTime) < MIN_EVENT_DURATION_MS) errors.endTime = "end_too_soon"
    else if (!wallClockExistsInZone(formWallClock(day, endTime), timeZone))
      errors.endTime = "time_dst_gap"
  }

  return errors
}
