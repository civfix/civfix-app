import { useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { CleanupStatus } from "@civfix/shared"
import { deriveCleanupStatus, type EventWindowLike } from "@civfix/shared/host"
import { queryKeys } from "./keys"
import { cleanupDetailFilters, invalidateCleanupLists } from "./hooks/cleanups"

export function useEventBoundaryRefresh(
  window: EventWindowLike | null,
  now: number,
  cleanupId: string | null | undefined,
): void {
  const qc = useQueryClient()
  const status = window === null ? null : deriveCleanupStatus(window, now)
  const settled = useRef<CleanupStatus | null>(status)

  useEffect(() => {
    if (status === null || !cleanupId) return
    if (settled.current === status) return
    settled.current = status
    void qc.invalidateQueries(cleanupDetailFilters(cleanupId))
    void qc.invalidateQueries({ queryKey: queryKeys.hostedEventsRoot })
    void qc.invalidateQueries({ queryKey: queryKeys.eventInsights(cleanupId) })
    void qc.invalidateQueries({ queryKey: queryKeys.eventHours(cleanupId) })
    void qc.invalidateQueries({ queryKey: queryKeys.cleanupAttendees(cleanupId) })
    invalidateCleanupLists(qc)
  }, [cleanupId, qc, status])
}
