import type { CleanupStatus } from "../schemas/entities.js"
import type { EventPhase } from "../schemas/host/insights.js"


export const LIVE_LEAD_MS = 2 * 3_600_000
export const LIVE_TAIL_MS = 2 * 3_600_000
export const DEFAULT_DURATION_MS = 4 * 3_600_000

export interface EventPhaseClock {
  status: CleanupStatus
  scheduledAt: string
  endsAt?: string | null
  completedAt?: string | null
}

function instant(value: string | null | undefined): number | null {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

export function eventPhase(clock: EventPhaseClock, now: number): EventPhase {
  if (clock.status === "cancelled") return "cancelled"
  if (clock.status === "done") return "ended"

  const startsAt = instant(clock.scheduledAt)
  if (startsAt === null || !Number.isFinite(now)) return "upcoming"

  const endsAt = instant(clock.endsAt) ?? startsAt + DEFAULT_DURATION_MS
  if (now >= endsAt + LIVE_TAIL_MS) return "ended"
  if (now >= startsAt - LIVE_LEAD_MS) return "live"
  return "upcoming"
}
