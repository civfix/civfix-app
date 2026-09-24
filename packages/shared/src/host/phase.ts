import type { CleanupStatus } from "../schemas/entities.js"
import type { EventPhase } from "../schemas/host/insights.js"
import { DEFAULT_EVENT_DURATION_MINUTES } from "../schemas/event-duration.js"

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS

export const LIVE_LEAD_MS = 2 * HOUR_MS
export const LIVE_TAIL_MS = 2 * HOUR_MS
export const DEFAULT_EVENT_DURATION_MS = DEFAULT_EVENT_DURATION_MINUTES * MINUTE_MS
export const DEFAULT_DURATION_MS = DEFAULT_EVENT_DURATION_MS

export interface EventWindowLike {
  status: CleanupStatus
  scheduledAt: string
  endsAt?: string | null
}

export interface EventPhaseClock extends EventWindowLike {
  completedAt?: string | null
}

export type HostStage = "upcoming" | "soon" | "underway" | "wrapping_up" | "past" | "cancelled"

function instant(value: string | null | undefined): number | null {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

export function eventStartsAtMs(window: Pick<EventWindowLike, "scheduledAt">): number | null {
  return instant(window.scheduledAt)
}

export function eventEndsAtMs(
  window: Pick<EventWindowLike, "scheduledAt" | "endsAt">,
): number | null {
  const endsAt = instant(window.endsAt)
  if (endsAt !== null) return endsAt
  const startsAt = instant(window.scheduledAt)
  return startsAt === null ? null : startsAt + DEFAULT_EVENT_DURATION_MS
}

export function hasEventStarted(
  window: Pick<EventWindowLike, "scheduledAt">,
  now: number,
): boolean {
  const startsAt = eventStartsAtMs(window)
  return startsAt !== null && now >= startsAt
}

export function hasEventEnded(
  window: Pick<EventWindowLike, "scheduledAt" | "endsAt">,
  now: number,
): boolean {
  const endsAt = eventEndsAtMs(window)
  return endsAt !== null && now >= endsAt
}

export function deriveCleanupStatus(window: EventWindowLike, now: number): CleanupStatus {
  if (window.status === "cancelled") return "cancelled"
  if (hasEventEnded(window, now)) return "done"
  if (hasEventStarted(window, now)) return "active"
  return "upcoming"
}

export function eventPhase(clock: EventPhaseClock, now: number): EventPhase {
  if (clock.status === "cancelled") return "cancelled"

  const startsAt = eventStartsAtMs(clock)
  const endsAt = eventEndsAtMs(clock)
  if (startsAt === null || endsAt === null || !Number.isFinite(now)) return "upcoming"

  if (now >= endsAt + LIVE_TAIL_MS) return "ended"
  if (now >= startsAt - LIVE_LEAD_MS) return "live"
  return "upcoming"
}

export function hostStage(window: EventWindowLike, now: number): HostStage {
  const phase = eventPhase(window, now)
  if (phase === "cancelled") return "cancelled"
  if (phase === "upcoming") return "upcoming"
  if (phase === "ended") return "past"

  const status = deriveCleanupStatus(window, now)
  if (status === "active") return "underway"
  return status === "done" ? "wrapping_up" : "soon"
}

export function nextEventBoundaryMs(window: EventWindowLike, now: number): number | null {
  if (window.status === "cancelled") return null

  const startsAt = eventStartsAtMs(window)
  const endsAt = eventEndsAtMs(window)
  if (startsAt === null || endsAt === null || !Number.isFinite(now)) return null

  const ahead = [startsAt - LIVE_LEAD_MS, startsAt, endsAt, endsAt + LIVE_TAIL_MS].filter(
    (boundary) => boundary > now,
  )
  return ahead.length === 0 ? null : Math.min(...ahead)
}
