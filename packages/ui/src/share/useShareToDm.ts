import { useCallback, useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { ApiClient } from "@civfix/shared/client"
import { useApi, useChatSocket } from "../data/context"
import { queryKeys } from "../data/keys"
import { QUEUED_SEND_TIMEOUT_MS, SEND_TIMEOUT_MS } from "../data/hooks/chat"
import { makeShareRuns, runShareToDm, SHARE_SOCKET_OPEN_TIMEOUT_MS } from "./shareDelivery"
import { summarizeShareRun, type SharePlanEntry, type ShareRunSummary } from "./shareToDm"

export function newShareClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export interface ShareToDmRun {
  entries: readonly SharePlanEntry[]
  body: string
  knownRooms?: ReadonlyMap<string, string>
}

export interface ShareToDmApi {
  send: (run: ShareToDmRun) => Promise<ShareRunSummary>
  abort: () => void
  isPending: boolean
}

async function openDmRoom(api: ApiClient, userId: string): Promise<string | null> {
  try {
    const { thread } = await api.openDm({ userId })
    const roomId = thread.refId ?? thread.id
    return roomId.length > 0 ? roomId : null
  } catch {
    return null
  }
}

export function useShareToDm(): ShareToDmApi {
  const api = useApi()
  const socket = useChatSocket()
  const queryClient = useQueryClient()
  const [isPending, setIsPending] = useState(false)
  const [runs] = useState(makeShareRuns)
  // Rooms this sheet already opened, so a retry reuses them instead of spending the openDm rate budget
  // again on recipients whose send timed out or was cut short.
  const openedRooms = useRef(new Map<string, string>())
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const abort = useCallback(() => {
    runs.abortAll()
  }, [runs])

  const send = useCallback(
    async ({ entries, body, knownRooms }: ShareToDmRun): Promise<ShareRunSummary> => {
      if (entries.length === 0) return summarizeShareRun(entries, new Map())
      const run = runs.begin()
      setIsPending(true)
      try {
        const { summary, rooms, resolved } = await runShareToDm(
          {
            socket,
            resolveRoom: (recipientId: string) => {
              const known = knownRooms?.get(recipientId) ?? openedRooms.current.get(recipientId)
              return known ? Promise.resolve(known) : openDmRoom(api, recipientId)
            },
            ackTimeoutMs: SEND_TIMEOUT_MS,
            queuedAckTimeoutMs: QUEUED_SEND_TIMEOUT_MS,
            openTimeoutMs: SHARE_SOCKET_OPEN_TIMEOUT_MS,
            signal: run.signal,
          },
          { entries, body },
        )
        for (const [recipientId, roomId] of resolved) openedRooms.current.set(recipientId, roomId)
        if (rooms.length > 0) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.threads })
          void queryClient.invalidateQueries({ queryKey: queryKeys.threadsUnread })
          for (const roomId of rooms) {
            void queryClient.invalidateQueries({ queryKey: queryKeys.chatHistory(roomId, "dm") })
          }
        }
        return summary
      } finally {
        runs.end(run)
        if (alive.current) setIsPending(runs.busy)
      }
    },
    [api, socket, queryClient, runs],
  )

  return { send, abort, isPending }
}
