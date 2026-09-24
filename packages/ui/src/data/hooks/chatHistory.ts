import { useCallback, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react"
import { useInfiniteQuery, type QueryClient } from "@tanstack/react-query"
import type { ChatHistoryResponse, ChatItem, ChatMessageDTO, RoomKind } from "@civfix/shared"
import type { ApiClient } from "@civfix/shared/client"
import { applyHistoryCacheOps, patchMessageInPages, prunableFrameIds, type HistoryCacheOp } from "../inbound"
import { queryKeys } from "../keys"
import { roomEndpoints, type ChatHistoryData } from "./chatRoom"

const CHAT_HISTORY_STALE_MS = 10_000
const CHAT_HISTORY_GC_MS = 5 * 60_000

export function useChatHistoryQuery(api: ApiClient, roomId: string, roomKind: RoomKind, canReadHistory: boolean) {
  return useInfiniteQuery<ChatHistoryResponse>({
    queryKey: queryKeys.chatHistory(roomId, roomKind),
    enabled: canReadHistory,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const before = pageParam as string | undefined
      return roomEndpoints(api, roomKind, roomId).page(before ? { before } : {})
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: false,
    staleTime: CHAT_HISTORY_STALE_MS,
    gcTime: CHAT_HISTORY_GC_MS,
  })
}

export interface ChatHistoryCacheDeps {
  api: ApiClient
  queryClient: QueryClient
  roomId: string
  roomKind: RoomKind
  canReadHistory: boolean
  liveMessagesRef: MutableRefObject<ChatMessageDTO[]>
  aroundWindowRef: MutableRefObject<ChatItem[] | null>
  setLiveMessages: Dispatch<SetStateAction<ChatMessageDTO[]>>
  setAroundWindow: Dispatch<SetStateAction<ChatItem[] | null>>
  pruneLiveMessages: (folded: ReadonlySet<string>) => void
}

/**
 * Writes to the room's history cache. While a history fetch is in flight its result would overwrite a
 * direct cache write, so writes are journaled in `cacheOpsRef` and drained once the fetch settles.
 */
export function useChatHistoryCache({
  api,
  queryClient,
  roomId,
  roomKind,
  canReadHistory,
  liveMessagesRef,
  aroundWindowRef,
  setLiveMessages,
  setAroundWindow,
  pruneLiveMessages,
}: ChatHistoryCacheDeps) {
  const roomGenerationRef = useRef(0)
  const cacheOpsRef = useRef<HistoryCacheOp[]>([])

  const findMessage = useCallback(
    (messageId: string, includePins = false): ChatMessageDTO | undefined => {
      const cached = queryClient.getQueryData<ChatHistoryData>(
        queryKeys.chatHistory(roomId, roomKind),
      )
      return (
        cached?.pages.flatMap((p) => p.items).find((m) => m.id === messageId) ??
        liveMessagesRef.current.find((m) => m.id === messageId) ??
        aroundWindowRef.current?.find((it) => it.message.id === messageId)?.message ??
        (includePins
          ? cached?.pages.flatMap((p) => p.pins ?? []).find((m) => m.id === messageId)
          : undefined)
      )
    },
    [queryClient, roomId, roomKind],
  )

  const isHistoryFetchInFlight = useCallback(() => {
    const state = queryClient.getQueryState(queryKeys.chatHistory(roomId, roomKind))
    return state !== undefined && state.fetchStatus !== "idle"
  }, [queryClient, roomId, roomKind])

  const drainCacheOps = useCallback(() => {
    if (cacheOpsRef.current.length === 0) return
    if (isHistoryFetchInFlight()) return
    const ops = cacheOpsRef.current
    cacheOpsRef.current = []
    const key = queryKeys.chatHistory(roomId, roomKind)
    const data = queryClient.getQueryData<ChatHistoryData>(key)
    if (!data || data.pages.length === 0) return
    const next = applyHistoryCacheOps(
      { pages: data.pages, pageParams: data.pageParams as unknown[] },
      ops,
    )
    if (next.pages !== data.pages || next.pageParams !== data.pageParams) {
      queryClient.setQueryData<ChatHistoryData>(key, {
        ...data,
        pages: next.pages,
        pageParams: next.pageParams,
      })
    }
    pruneLiveMessages(prunableFrameIds(ops, next.pages))
  }, [queryClient, roomId, roomKind, isHistoryFetchInFlight, pruneLiveMessages])

  const refreshNewestPage = useCallback(() => {
    if (!canReadHistory) return
    const key = queryKeys.chatHistory(roomId, roomKind)
    const existing = queryClient.getQueryData<ChatHistoryData>(key)
    if (!existing || existing.pages.length === 0) return
    const generation = roomGenerationRef.current
    roomEndpoints(api, roomKind, roomId)
      .page()
      .then((page) => {
        // After an in-place room switch the journal belongs to the new room; the room left keeps its gap,
        // so its cached history must refetch when it is opened again.
        if (roomGenerationRef.current !== generation) {
          void queryClient.invalidateQueries({ queryKey: key, refetchType: "none" })
          return
        }
        const current = queryClient.getQueryData<ChatHistoryData>(key)
        if (!current || current.pages.length === 0) return
        const op: HistoryCacheOp = {
          kind: "newestPage",
          page: { ...page, items: page.items.filter((m) => m.cleanupId === roomId) },
        }
        if (isHistoryFetchInFlight()) {
          cacheOpsRef.current.push(op)
          return
        }
        const next = applyHistoryCacheOps(
          { pages: current.pages, pageParams: current.pageParams as unknown[] },
          [op],
        )
        if (next.pages !== current.pages || next.pageParams !== current.pageParams) {
          queryClient.setQueryData<ChatHistoryData>(key, {
            ...current,
            pages: next.pages,
            pageParams: next.pageParams,
          })
        }
      })
      .catch(() => {
        void queryClient.invalidateQueries({ queryKey: key, refetchType: "none" })
      })
  }, [api, canReadHistory, queryClient, roomId, roomKind, isHistoryFetchInFlight])

  const patchMessage = useCallback(
    (messageId: string, patch: Partial<ChatMessageDTO>) => {
      const key = queryKeys.chatHistory(roomId, roomKind)
      const data = queryClient.getQueryData<ChatHistoryData>(key)
      if (data) {
        const pages = patchMessageInPages(data.pages, messageId, patch)
        if (pages !== data.pages) {
          queryClient.setQueryData<ChatHistoryData>(key, { ...data, pages })
        }
      }
      if (isHistoryFetchInFlight()) {
        cacheOpsRef.current.push({ kind: "patch", messageId, patch })
      }
      setLiveMessages((prev) =>
        prev.some((m) => m.id === messageId)
          ? prev.map((m) => (m.id === messageId ? { ...m, ...patch } : m))
          : prev,
      )
      setAroundWindow((prev) => {
        if (!prev || !prev.some((it) => it.message.id === messageId)) return prev
        return prev.map((it) =>
          it.message.id === messageId ? { ...it, message: { ...it.message, ...patch } } : it,
        )
      })
    },
    [queryClient, roomId, roomKind, isHistoryFetchInFlight],
  )

  const resetHistoryJournal = useCallback(() => {
    cacheOpsRef.current = []
    roomGenerationRef.current++
  }, [])

  return {
    cacheOpsRef,
    findMessage,
    isHistoryFetchInFlight,
    drainCacheOps,
    refreshNewestPage,
    patchMessage,
    resetHistoryJournal,
  }
}
