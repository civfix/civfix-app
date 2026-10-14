import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { focusManager, onlineManager, useQueryClient } from "@tanstack/react-query"
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
import { ErrorCode, appErrorCode } from "@civfix/shared"

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

export function bufferedForReload<T>(
  bufferOwnerId: string | null | undefined,
  ownerId: string | null,
  buffered: readonly T[],
): T[] {
  return bufferOwnerId === ownerId ? [...buffered] : []
}

// onlineManager is fed by the browser's online event on web; React Native has no connectivity
// module yet, so on native only the foreground wake (AppState -> focusManager) fires here.
export function subscribeOutboxWake(onWake: () => void): () => void {
  const offFocus = focusManager.subscribe((focused) => {
    if (focused) onWake()
  })
  const offOnline = onlineManager.subscribe((online) => {
    if (online) onWake()
  })
  return () => {
    offFocus()
    offOnline()
  }
}

export function useCheckinOutbox(cleanupId: string): CheckinOutbox {
  const api = useApi()
  const qc = useQueryClient()
  const store = useSecureStore()
  const ownerId = useAuthState().user?.id ?? null
  const ownerIdRef = useRef(ownerId)
  const [state, setState] = useState<CheckinOutboxState>(EMPTY_CHECKIN_OUTBOX)
  const [replaying, setReplaying] = useState(false)
  const [report, setReport] = useState<CheckinReplayReport | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state
  const inFlight = useRef(false)
  const loaded = useRef(false)
  const buffered = useRef<CheckinOutboxInput[]>([])
  const bufferOwner = useRef<string | null | undefined>(undefined)

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
            return { status: "error", code: appErrorCode(err) ?? ErrorCode.INTERNAL }
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

  const commitRef = useRef(commit)
  const replayRef = useRef(replay)
  useLayoutEffect(() => {
    ownerIdRef.current = ownerId
    commitRef.current = commit
    replayRef.current = replay
  })

  // Keyed on what selects the stored blob only: `commit`/`replay` change identity with `api`/`qc`,
  // and a reload for the same owner must keep the scans queued before the first load resolved.
  useEffect(() => {
    buffered.current = bufferedForReload(bufferOwner.current, ownerId, buffered.current)
    bufferOwner.current = ownerId
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
      if (waiting.length > 0) commitRef.current(merged)
      else {
        stateRef.current = merged
        setState(merged)
      }
      if (pending(merged, Date.now(), cleanupId) > 0) void replayRef.current()
    })
    return () => {
      cancelled = true
    }
  }, [cleanupId, ownerId, store])

  useEffect(
    () =>
      subscribeOutboxWake(() => {
        if (pending(stateRef.current, Date.now(), cleanupId) > 0) void replayRef.current()
      }),
    [cleanupId],
  )

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
