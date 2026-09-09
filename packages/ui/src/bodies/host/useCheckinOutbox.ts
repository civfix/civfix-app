import { useCallback, useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useApi, useAuthState } from "../../data"
import { invalidateHostEvent } from "../../data/hooks/host"
import { useSecureStore } from "../../capabilities"
import {
  EMPTY_CHECKIN_OUTBOX,
  dequeueReady,
  enqueue,
  loadOutbox,
  mergeQueued,
  pending,
  replayReportNotable,
  runReplay,
  saveOutbox,
  type CheckinOutboxInput,
  type CheckinOutboxState,
  type CheckinReplayReport,
  type ReplayAttempt,
} from "../../data/checkinOutbox"
import { appErrorCode } from "../errorCode"

export interface CheckinOutbox {
  pending: number
  queue: (input: Omit<CheckinOutboxInput, "cleanupId">) => void
  replay: () => Promise<void>
  replaying: boolean
  report: CheckinReplayReport | null
  dismissReport: () => void
}

export function outboxPersistOwner(
  committedOwnerId: string | null,
  currentOwnerId: string | null,
): string | null {
  return committedOwnerId !== null && committedOwnerId === currentOwnerId ? committedOwnerId : null
}

export function useCheckinOutbox(cleanupId: string): CheckinOutbox {
  const api = useApi()
  const qc = useQueryClient()
  const store = useSecureStore()
  const ownerId = useAuthState().user?.id ?? null
  const ownerIdRef = useRef(ownerId)
  ownerIdRef.current = ownerId
  const [state, setState] = useState<CheckinOutboxState>(EMPTY_CHECKIN_OUTBOX)
  const [replaying, setReplaying] = useState(false)
  const [report, setReport] = useState<CheckinReplayReport | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state
  const inFlight = useRef(false)
  const loaded = useRef(false)
  const buffered = useRef<CheckinOutboxInput[]>([])

  const commit = useCallback(
    (next: CheckinOutboxState) => {
      stateRef.current = next
      setState(next)
      const owner = outboxPersistOwner(ownerId, ownerIdRef.current)
      if (owner !== null) void saveOutbox(store, next, owner)
    },
    [ownerId, store],
  )

  const replay = useCallback(async () => {
    if (inFlight.current || !loaded.current) return
    inFlight.current = true
    setReplaying(true)
    try {
      const batch = dequeueReady(stateRef.current, Date.now(), { cleanupId })
      const run = await runReplay(
        stateRef.current,
        batch,
        async (entry, subject): Promise<ReplayAttempt> => {
          try {
            const result =
              subject.kind === "scan"
                ? await api.scanEventTicket({ id: entry.cleanupId, token: subject.token })
                : await api.checkInEventSeat({
                    id: entry.cleanupId,
                    seatId: subject.seatId,
                    method: "manual",
                  })
            return { status: "ok", outcome: result.outcome }
          } catch (err) {
            return { status: "error", code: appErrorCode(err) ?? "INTERNAL" }
          }
        },
        { now: () => Date.now(), onState: commit, scope: { cleanupId } },
      )
      if (run.sentAny) invalidateHostEvent(qc, cleanupId)
      setReport(replayReportNotable(run.report) ? run.report : null)
    } finally {
      inFlight.current = false
      setReplaying(false)
    }
  }, [api, cleanupId, commit, qc])

  useEffect(() => {
    buffered.current = []
    if (ownerId === null) {
      loaded.current = true
      stateRef.current = EMPTY_CHECKIN_OUTBOX
      setState(EMPTY_CHECKIN_OUTBOX)
      return
    }
    loaded.current = false
    let cancelled = false
    void loadOutbox(store, Date.now(), ownerId).then((stored) => {
      if (cancelled) return
      const waiting = buffered.current
      buffered.current = []
      loaded.current = true
      const merged = mergeQueued(stored, waiting, Date.now())
      if (waiting.length > 0) commit(merged)
      else {
        stateRef.current = merged
        setState(merged)
      }
      if (pending(merged, Date.now(), cleanupId) > 0) void replay()
    })
    return () => {
      cancelled = true
    }
  }, [cleanupId, commit, ownerId, replay, store])

  const queue = useCallback(
    (input: Omit<CheckinOutboxInput, "cleanupId">) => {
      const scoped: CheckinOutboxInput = { ...input, cleanupId }
      const next = enqueue(stateRef.current, scoped, Date.now())
      if (loaded.current) {
        commit(next)
        return
      }
      buffered.current = [...buffered.current, scoped]
      stateRef.current = next
      setState(next)
    },
    [cleanupId, commit],
  )

  const dismissReport = useCallback(() => setReport(null), [])

  return {
    pending: pending(state, Date.now(), cleanupId),
    queue,
    replay,
    replaying,
    report,
    dismissReport,
  }
}
