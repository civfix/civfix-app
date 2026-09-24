import { useCallback, useEffect, useRef } from "react"
import type { QueryClient } from "@tanstack/react-query"
import type { RoomKind } from "@civfix/shared"
import { queryKeys } from "../keys"
import { readAckToFlush, type PendingReadAck } from "../readAck"
import type { ChatConnState, ChatSocketLike } from "../types"

const READ_ACK_DEBOUNCE_MS = 1_200

export interface ChatReadAckDeps {
  socket: ChatSocketLike
  queryClient: QueryClient
  roomId: string
  roomKind: RoomKind
  stampRoomKind: boolean
}

/** The room's read watermark: acked once per newest message, and flushed when the room is left. */
export function useChatReadAck({ socket, queryClient, roomId, roomKind, stampRoomKind }: ChatReadAckDeps) {
  const readAckTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastAckedIdRef = useRef<string | null>(null)
  const pendingAckRef = useRef<PendingReadAck | null>(null)

  const postReadAck = useCallback(
    (upToId: string) => {
      lastAckedIdRef.current = upToId
      pendingAckRef.current = null
      socket.send({ type: "ack", upToId, cleanupId: roomId, ...(stampRoomKind ? { roomKind } : {}) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.threads })
    },
    [socket, roomId, roomKind, stampRoomKind, queryClient],
  )

  const sendReadAck = useCallback(
    (upToId: string) => {
      if (lastAckedIdRef.current === upToId) return
      postReadAck(upToId)
    },
    [postReadAck],
  )

  const flushPendingReadAck = useCallback(() => {
    const flushUpToId = readAckToFlush(pendingAckRef.current, roomId, roomKind)
    if (flushUpToId !== null) postReadAck(flushUpToId)
  }, [postReadAck, roomId, roomKind])

  const resetReadAck = useCallback(() => {
    lastAckedIdRef.current = null
    pendingAckRef.current = null
  }, [])

  return { readAckTimer, lastAckedIdRef, pendingAckRef, sendReadAck, flushPendingReadAck, resetReadAck }
}

export interface ReadAckDebounceDeps {
  readAck: ReturnType<typeof useChatReadAck>
  enabled: boolean
  suppressReadAcks: boolean
  connection: ChatConnState
  newestMessageId: string | null
  roomId: string
  roomKind: RoomKind
}

/** Acks the newest confirmed message once it has stayed newest for the debounce window. */
export function useDebouncedReadAck({
  readAck,
  enabled,
  suppressReadAcks,
  connection,
  newestMessageId,
  roomId,
  roomKind,
}: ReadAckDebounceDeps): void {
  const { readAckTimer, lastAckedIdRef, pendingAckRef, sendReadAck } = readAck
  useEffect(() => {
    if (!enabled || suppressReadAcks || connection !== "open" || !newestMessageId) return
    if (lastAckedIdRef.current === newestMessageId) return
    pendingAckRef.current = { roomId, roomKind, upToId: newestMessageId }
    if (readAckTimer.current) clearTimeout(readAckTimer.current)
    readAckTimer.current = setTimeout(() => {
      readAckTimer.current = null
      sendReadAck(newestMessageId)
    }, READ_ACK_DEBOUNCE_MS)

    return () => {
      if (readAckTimer.current) {
        clearTimeout(readAckTimer.current)
        readAckTimer.current = null
      }
    }
  }, [connection, newestMessageId, enabled, suppressReadAcks, roomId, roomKind, sendReadAck])
}
