import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AppError,
  ErrorCode,
  mergeChatItems,
  type ChatItem,
  type ChatMessageDTO,
  type ListThreadsResponse,
  type ReactionEmoji,
  type RoomKind,
} from "@civfix/shared"
import { useApi, useAuthState, useChatSocket } from "../context"
import { coercePages } from "../infinitePages"
import { restoreLocalChatAttachments } from "../localChatAttachments"
import type { ChatConnState } from "../types"
import { queryKeys } from "../keys"
import { mergePins } from "../pins"
import { useChatAroundWindow } from "./chatAround"
import { useChatBuffers } from "./chatBuffers"
import { useChatHistoryCache, useChatHistoryQuery } from "./chatHistory"
import { useChatInbound } from "./chatInbound"
import { useChatMessageActions, type CreatePollInput } from "./chatMessageActions"
import { useChatOutbox } from "./chatOutbox"
import { useChatPresence } from "./chatPresence"
import { useChatReadAck, useDebouncedReadAck } from "./chatReadAck"
import type { ChatRoomError, ComposerMedia } from "./chatRoom"
import { useChatRoomSocket } from "./chatRoomSocket"
import { useChatTyping, useClearTypingTimersOnUnmount } from "./chatTyping"

export type { ChatRoomError, ComposerMedia } from "./chatRoom"
export { markResending, QUEUED_SEND_TIMEOUT_MS, SEND_TIMEOUT_MS } from "./chatOutbox"

const UNREAD_BADGE_STALE_MS = 30_000

const selectThreadPages = coercePages<ListThreadsResponse>("items")

export function useThreads() {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useInfiniteQuery<ListThreadsResponse>({
    queryKey: queryKeys.threads,
    enabled: isAuthenticated,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.listThreads({ ...(pageParam ? { cursor: pageParam as string } : {}) }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: false,
    select: selectThreadPages,
  })
}

export const UNREAD_BADGE_PAGE_SIZE = 20

export function sumThreadUnread(data: ListThreadsResponse | undefined): number {
  const items = Array.isArray(data?.items) ? data.items : []
  return items.reduce((sum, t) => sum + (t?.unread ?? 0), 0)
}

export function useTotalUnread(): number {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  const query = useQuery<ListThreadsResponse, unknown, number>({
    queryKey: queryKeys.threadsUnread,
    enabled: isAuthenticated,
    queryFn: () => api.listThreads({ limit: UNREAD_BADGE_PAGE_SIZE }),
    select: sumThreadUnread,
    staleTime: UNREAD_BADGE_STALE_MS,
  })
  return query.data ?? 0
}

export interface UseChatResult {
  items: ChatItem[]
  isLoading: boolean
  isError: boolean
  isNotFound: boolean
  isForbidden: boolean
  hasMore: boolean
  isLoadingMore: boolean
  loadOlder: () => void
  connection: ChatConnState
  liveDisabled: boolean
  roomError: ChatRoomError | null
  transientError: ChatRoomError | null
  send: (body: string, mentionedUserIds?: string[], media?: ComposerMedia[], replyToId?: string) => void
  edit: (messageId: string, body: string, mentionedUserIds?: string[]) => Promise<void>
  delete: (messageId: string) => Promise<void>
  setPinned: (messageId: string, pinned: boolean) => Promise<void>
  pins: ChatMessageDTO[]
  createPoll: (input: CreatePollInput) => Promise<void>
  votePoll: (messageId: string, optionIdxs: number[]) => Promise<void>
  closePoll: (messageId: string) => Promise<void>
  toggleReaction: (messageId: string, emoji: ReactionEmoji) => void
  retry: (clientId: string) => void
  sendTyping: () => void
  typingUserIds: string[]
  onlineCount: number
  aroundWindow: ChatItem[] | null
  aroundLoading: boolean
  fetchAround: (messageId: string) => Promise<boolean>
  clearAround: () => void
}

function isErrorCode(err: unknown, code: ErrorCode): boolean {
  return err instanceof AppError && err.code === code
}

export interface UseChatOptions {
  suppressReadAcks?: boolean
}

export function useChat(roomId: string, roomKind: RoomKind = "cleanup", options?: UseChatOptions): UseChatResult {
  const api = useApi()
  const socket = useChatSocket()
  const { isAuthenticated, user } = useAuthState()
  const myUserId = user?.id ?? null
  const queryClient = useQueryClient()
  const suppressReadAcks = options?.suppressReadAcks === true

  const enabled = isAuthenticated && roomId.length > 0
  const isDm = roomKind === "dm"
  const isReport = roomKind === "report"
  const stampRoomKind = roomKind !== "cleanup"
  const canReadHistory = roomId.length > 0 && (isAuthenticated || isReport)

  const history = useChatHistoryQuery(api, roomId, roomKind, canReadHistory)
  const {
    liveMessages,
    setLiveMessages,
    liveMessagesRef,
    outbox,
    setOutbox,
    outboxRef,
    aroundWindow,
    setAroundWindow,
    aroundWindowRef,
    pruneLiveMessages,
  } = useChatBuffers()
  const [connection, setConnection] = useState<ChatConnState>(socket.getStatus())
  const [joinRejected, setJoinRejected] = useState<ChatRoomError | null>(null)
  const [transientError, setTransientError] = useState<ChatRoomError | null>(null)
  const presence = useChatPresence(myUserId)
  const { setOnlineUserIds } = presence
  const typing = useChatTyping({ socket, roomId, roomKind, stampRoomKind, enabled })
  const { clearTypingState } = typing
  const historyCache = useChatHistoryCache({
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
  })
  const { findMessage, patchMessage, drainCacheOps, refreshNewestPage, resetHistoryJournal } = historyCache
  const outboxActions = useChatOutbox({
    socket,
    roomId,
    roomKind,
    stampRoomKind,
    enabled,
    myUserId,
    user,
    outbox,
    outboxRef,
    setOutbox,
    setTransientError,
    findMessage,
  })
  const { send, retry, replayOutbox, resetSendTracking } = outboxActions
  const inbound = useChatInbound({
    queryClient,
    roomId,
    roomKind,
    journalInbound: historyCache.journalInbound,
    isHistoryFetchInFlight: historyCache.isHistoryFetchInFlight,
    setOutbox,
    setLiveMessages,
    pruneLiveMessages,
    settleSend: outboxActions.settleSend,
  })
  const { aroundLoading, fetchAround, clearAround } = useChatAroundWindow({
    api,
    roomId,
    roomKind,
    myUserId,
    setAroundWindow,
  })
  const readAck = useChatReadAck({ socket, queryClient, roomId, roomKind, stampRoomKind })
  const replayOnReconnectRef = useRef<() => void>(() => {})
  const wasOpenRef = useRef(false)

  // Effect order is load-bearing: on a room switch the socket teardown flushes the old room's read
  // watermark before the reset below clears per-room state, and the reset empties the cache journal
  // before the drain effect could replay it into the new room.
  useChatRoomSocket({
    socket,
    roomId,
    roomKind,
    enabled,
    myUserId,
    setConnection,
    setJoinRejected,
    setTransientError,
    setAroundWindow,
    historyCache,
    inbound,
    typing,
    presence,
    outbox: outboxActions,
    readAck,
  })

  useEffect(() => {
    setLiveMessages([])
    setOutbox([])
    resetSendTracking()
    resetHistoryJournal()
    setTransientError(null)
    setOnlineUserIds(new Set())
    clearTypingState()
    clearAround()
  }, [roomId, roomKind, clearTypingState, resetSendTracking, resetHistoryJournal, clearAround])

  useClearTypingTimersOnUnmount(typing.typingTimers)

  // The reconnect effect is keyed on the connection edge alone; the replay reads the outbox, history and
  // senders of the last committed render through this ref instead of re-running on each of them.
  useLayoutEffect(() => {
    replayOnReconnectRef.current = () => {
      replayOutbox()
      if (history.isError) {
        void history.refetch()
      } else {
        refreshNewestPage()
      }
    }
  })

  useEffect(() => {
    const open = connection === "open"
    if (open && !wasOpenRef.current) replayOnReconnectRef.current()
    wasOpenRef.current = open
  }, [connection])

  useEffect(() => {
    if (!history.isFetching) drainCacheOps()
  }, [history.isFetching, drainCacheOps])

  const { toggleReaction, edit, deleteMessage, setPinned, createPoll, votePoll, closePoll } =
    useChatMessageActions({ api, roomId, roomKind, findMessage, patchMessage, reconcile: inbound.reconcile })

  const items = useMemo<ChatItem[]>(() => {
    const historyItems: ChatMessageDTO[] = (history.data?.pages ?? [])
      .flatMap((p) => p.items)
      .filter((m) => m.cleanupId === roomId)
    const live = liveMessages.filter((m) => m.cleanupId === roomId)
    const pending = outbox.filter((e) => e.message.cleanupId === roomId)
    return restoreLocalChatAttachments(mergeChatItems(historyItems, live, pending, myUserId))
  }, [history.data, liveMessages, outbox, myUserId, roomId])

  const pins = useMemo<ChatMessageDTO[]>(() => {
    const pages = history.data?.pages ?? []
    const initial = pages.flatMap((p) => p.pins ?? []).filter((m) => m.cleanupId === roomId)
    const loaded = pages
      .flatMap((p) => p.items)
      .concat(liveMessages)
      .filter((m) => m.cleanupId === roomId)
    return mergePins(initial, loaded)
  }, [history.data, liveMessages, roomId])

  const newestMessageId = useMemo<string | null>(() => {
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i]
      if (item && !item.pending && !item.failed) return item.message.id
    }
    return null
  }, [items])

  useDebouncedReadAck({
    scheduleReadAck: readAck.scheduleReadAck,
    enabled,
    suppressReadAcks,
    connection,
    newestMessageId,
    roomId,
    roomKind,
  })

  const historyForbidden = isErrorCode(history.error, ErrorCode.FORBIDDEN)
  const roomError =
    joinRejected ??
    (isDm && historyForbidden
      ? { code: ErrorCode.FORBIDDEN, message: "This person isn't accepting messages." }
      : null)

  return {
    items,
    isLoading: history.isLoading,
    isError: history.isError,
    isNotFound: isErrorCode(history.error, ErrorCode.NOT_FOUND),
    isForbidden: historyForbidden,
    hasMore: Boolean(history.hasNextPage),
    isLoadingMore: history.isFetchingNextPage,
    loadOlder: () => {
      if (history.hasNextPage && !history.isFetchingNextPage) void history.fetchNextPage()
    },
    connection,
    liveDisabled: !enabled,
    roomError,
    transientError,
    send,
    edit,
    delete: deleteMessage,
    setPinned,
    pins,
    createPoll,
    votePoll,
    closePoll,
    toggleReaction,
    retry,
    sendTyping: typing.sendTyping,
    typingUserIds: typing.typingUserIds,
    onlineCount: presence.onlineCount,
    aroundWindow,
    aroundLoading,
    fetchAround,
    clearAround,
  }
}
