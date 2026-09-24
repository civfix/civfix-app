import { useCallback, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react"
import type { QueryClient } from "@tanstack/react-query"
import { effectiveClientId, type ChatMessageDTO, type OutboxEntry, type RoomKind } from "@civfix/shared"
import {
  foldInboundBatch,
  foldInboundIntoPages,
  journalFrames,
  prunableFrameIds,
  type HistoryCacheOp,
  type InboundFrame,
} from "../inbound"
import { queryKeys } from "../keys"
import { linkLocalChatAttachments } from "../localChatAttachments"
import type { ChatHistoryData } from "./chatRoom"

const INBOUND_FLUSH_MS = 50

export interface ChatInboundDeps {
  queryClient: QueryClient
  roomId: string
  roomKind: RoomKind
  cacheOpsRef: MutableRefObject<HistoryCacheOp[]>
  isHistoryFetchInFlight: () => boolean
  setOutbox: Dispatch<SetStateAction<OutboxEntry[]>>
  setLiveMessages: Dispatch<SetStateAction<ChatMessageDTO[]>>
  pruneLiveMessages: (folded: ReadonlySet<string>) => void
  settleSend: (clientId: string) => void
}

/** Server messages arrive in bursts; they are buffered briefly and folded into history as one batch. */
export function useChatInbound({
  queryClient,
  roomId,
  roomKind,
  cacheOpsRef,
  isHistoryFetchInFlight,
  setOutbox,
  setLiveMessages,
  pruneLiveMessages,
  settleSend,
}: ChatInboundDeps) {
  const inboundBuffer = useRef<InboundFrame[]>([])
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flushInbound = useCallback(() => {
    flushTimer.current = null
    const batch = inboundBuffer.current
    if (batch.length === 0) return
    inboundBuffer.current = []
    setOutbox((prev) => foldInboundBatch(prev, [], batch).outbox)
    if (isHistoryFetchInFlight()) {
      cacheOpsRef.current = journalFrames(cacheOpsRef.current, batch)
      setLiveMessages((prev) => foldInboundBatch([], prev, batch).liveMessages)
      return
    }
    const key = queryKeys.chatHistory(roomId, roomKind)
    const data = queryClient.getQueryData<ChatHistoryData>(key)
    if (data && data.pages.length > 0) {
      const pages = foldInboundIntoPages(data.pages, batch)
      if (pages !== data.pages) {
        queryClient.setQueryData<ChatHistoryData>(key, { ...data, pages })
      }
      pruneLiveMessages(prunableFrameIds([{ kind: "frames", frames: batch }], pages))
    } else {
      setLiveMessages((prev) => foldInboundBatch([], prev, batch).liveMessages)
    }
  }, [queryClient, roomId, roomKind, isHistoryFetchInFlight, pruneLiveMessages])

  const reconcile = useCallback(
    (message: ChatMessageDTO, explicitClientId?: string, viewerTruth?: boolean) => {
      const cid = effectiveClientId(message, explicitClientId)
      if (cid) {
        linkLocalChatAttachments(cid, message.id)
        settleSend(cid)
      }
      inboundBuffer.current.push({ message, explicitClientId, viewerTruth })
      if (flushTimer.current === null) flushTimer.current = setTimeout(flushInbound, INBOUND_FLUSH_MS)
    },
    [settleSend, flushInbound],
  )

  const discardPendingInbound = useCallback(() => {
    if (flushTimer.current !== null) {
      clearTimeout(flushTimer.current)
      flushTimer.current = null
    }
    inboundBuffer.current = []
  }, [])

  return { reconcile, discardPendingInbound }
}
