import { useCallback, useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { ApiClient } from "@civfix/shared/client"
import { useApi, useChatSocket } from "../data/context"
import { queryKeys } from "../data/keys"
import { SEND_TIMEOUT_MS } from "../data/hooks/chat"
import { runShareToDm, SHARE_SOCKET_OPEN_TIMEOUT_MS } from "./shareDelivery"
import { summarizeShareRun, type SharePlanEntry, type ShareRunSummary } from "./shareToDm"

export { SHARE_SOCKET_OPEN_TIMEOUT_MS } from "./shareDelivery"

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
  const abortedRef = useRef(false)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const abort = useCallback(() => {
    abortedRef.current = true
  }, [])

  const send = useCallback(
    async ({ entries, body, knownRooms }: ShareToDmRun): Promise<ShareRunSummary> => {
      abortedRef.current = false
      if (entries.length === 0) return summarizeShareRun(entries, new Map())
      setIsPending(true)
      try {
        const { summary, rooms } = await runShareToDm(
          {
            socket,
            resolveRoom: (recipientId: string) => {
              const known = knownRooms?.get(recipientId)
              return known ? Promise.resolve(known) : openDmRoom(api, recipientId)
            },
            ackTimeoutMs: SEND_TIMEOUT_MS,
            openTimeoutMs: SHARE_SOCKET_OPEN_TIMEOUT_MS,
            isAborted: () => abortedRef.current,
          },
          { entries, body },
        )
        if (rooms.length > 0) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.threads })
          void queryClient.invalidateQueries({ queryKey: queryKeys.threadsUnread })
          for (const roomId of rooms) {
            void queryClient.invalidateQueries({ queryKey: queryKeys.chatHistory(roomId, "dm") })
          }
        }
        return summary
      } finally {
        if (alive.current) setIsPending(false)
      }
    },
    [api, socket, queryClient],
  )

  return { send, abort, isPending }
}
