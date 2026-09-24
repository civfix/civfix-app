export type EventStatusTone = "cancelled" | "ended" | "live"

export interface EventStatusLine {
  /** An `event-detail` key. */
  key: string
  tone: EventStatusTone
}

/**
 * The one status line under the event title. The event's own lifecycle outranks the viewer's role: a
 * cancelled or ended event says so even to its host, and a live one names the viewer's hosting role.
 */
export function eventStatusLine(input: {
  isCancelled: boolean
  isDone: boolean
  isOrganizer: boolean
  isCohost: boolean
}): EventStatusLine | null {
  if (input.isCancelled) return { key: "status.cancelled", tone: "cancelled" }
  if (input.isDone) return { key: "status.ended", tone: "ended" }
  if (input.isOrganizer) return { key: "status.hosting", tone: "live" }
  if (input.isCohost) return { key: "status.cohosting", tone: "live" }
  return null
}
