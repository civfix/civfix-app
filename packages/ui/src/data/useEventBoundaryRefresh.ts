import { useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { CleanupStatus } from "@civfix/shared"
import { deriveCleanupStatus, type EventWindowLike } from "@civfix/shared/host"
import { queryKeys } from "./keys"
import { cleanupDetailFilters, invalidateCleanupLists } from "./hooks/cleanups"

export interface EventBoundarySnapshot {
  cleanupId: string | null | undefined
  status: CleanupStatus | null
}

// Only the SAME event changing status is a boundary. A body reused for another event, or a window that
// just loaded, is a new baseline, not a reason to refetch everything that was just fetched.
export function eventBoundaryCrossed(prev: EventBoundarySnapshot, next: EventBoundarySnapshot): boolean {
  return (
    prev.cleanupId === next.cleanupId &&
    prev.status !== null &&
    next.status !== null &&
    prev.status !== next.status
  )
}

export function useEventBoundaryRefresh(
  window: EventWindowLike | null,
  now: number,
  cleanupId: string | null | undefined,
): void {
  const qc = useQueryClient()
  const status = window === null ? null : deriveCleanupStatus(window, now)
  const settled = useRef<EventBoundarySnapshot>({ cleanupId, status })

  useEffect(() => {
    if (status === null) return
    const crossed = eventBoundaryCrossed(settled.current, { cleanupId, status })
    settled.current = { cleanupId, status }
    if (!crossed || !cleanupId) return
    void qc.invalidateQueries(cleanupDetailFilters(cleanupId))
    void qc.invalidateQueries({ queryKey: queryKeys.hostedEventsRoot })
    void qc.invalidateQueries({ queryKey: queryKeys.eventInsights(cleanupId) })
    void qc.invalidateQueries({ queryKey: queryKeys.eventHours(cleanupId) })
    void qc.invalidateQueries({ queryKey: queryKeys.cleanupAttendees(cleanupId) })
    invalidateCleanupLists(qc)
  }, [cleanupId, qc, status])
}
