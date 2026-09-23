import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query"
import {
  AppError,
  ErrorCode,
  mergeChatItems,
  effectiveClientId,
  preserveViewerFields,
  type ChatHistoryResponse,
  type ChatItem,
  type ChatMessageDTO,
  type ListThreadsResponse,
  type MediaDTO,
  type MediaKind,
  type OutboxEntry,
  type ReactionEmoji,
  type ReplyToDTO,
  type RoomKind,
} from "@civfix/shared"
import { useApi, useAuthState, useChatSocket } from "../context"
import { applyUpdatesToWindow } from "../aroundWindow"
import {
  applyHistoryCacheOps,
  foldInboundBatch,
  foldInboundIntoPages,
  frameInRoom,
  isFatalRoomErrorCode,
  isSendRejectionErrorCode,
  journalFrames,
  patchMessageInPages,
  prunableFrameIds,
  replayableEntries,
  type HistoryCacheOp,
  type InboundFrame,
} from "../inbound"
import {
  linkLocalChatAttachments,
  rememberLocalChatAttachments,
  restoreLocalChatAttachments,
} from "../localChatAttachments"
import { buildLocalReplyTo } from "../replyPreview"
import { readAckToFlush, type PendingReadAck } from "../readAck"
import { chatSendOutcome, type ChatConnState } from "../types"
import { queryKeys } from "../keys"
import { toggleReactionBucket } from "../reactions"
import { mergePins } from "../pins"
import { applyVoteLocally } from "../pollVote"

const PAGE_SIZE = 30
export const SEND_TIMEOUT_MS = 12_000
export const QUEUED_SEND_TIMEOUT_MS = 5 * SEND_TIMEOUT_MS
const TYPING_THROTTLE_MS = 2_000
const TYPING_EXPIRY_MS = 5_000
const READ_ACK_DEBOUNCE_MS = 1_200

type ChatHistoryData = InfiniteData<ChatHistoryResponse>

function selectThreadPages(
  data: InfiniteData<ListThreadsResponse>,
): InfiniteData<ListThreadsResponse> {
  return {
    ...data,
    pages: data.pages.map((p) => ({
      ...p,
      items: Array.isArray(p?.items) ? p.items.filter((t) => t != null) : [],
    })),
  }
}

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
    staleTime: 30_000,
  })
  return query.data ?? 0
}

export interface ChatRoomError {
  code: string
  message: string
}

export interface ComposerMedia {
  uploadId: string
  kind: MediaKind
  localUri: string
  posterUri?: string | null
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
  createPoll: (input: {
    question: string
    options: string[]
    allowMultiple: boolean
    anonymous: boolean
  }) => Promise<void>
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

function newClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function isErrorCode(err: unknown, code: ErrorCode): boolean {
  return err instanceof AppError && err.code === code
}

export function markResending(outbox: OutboxEntry[], clientIds: ReadonlySet<string>): OutboxEntry[] {
  if (clientIds.size === 0) return outbox
  return outbox.map((e) =>
    e.status === "failed" && clientIds.has(e.clientId) ? { ...e, status: "sending" } : e,
  )
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
  const isGroup = roomKind === "group"
  const stampRoomKind = roomKind !== "cleanup"
  const canReadHistory = roomId.length > 0 && (isAuthenticated || isReport)

  const history = useInfiniteQuery<ChatHistoryResponse>({
    queryKey: queryKeys.chatHistory(roomId, roomKind),
    enabled: canReadHistory,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const before = pageParam as string | undefined
      if (isDm) return api.dmMessages({ threadId: roomId, ...(before ? { before } : {}), limit: PAGE_SIZE })
      if (isReport) return api.reportMessages({ id: roomId, ...(before ? { before } : {}), limit: PAGE_SIZE })
      if (isGroup) return api.groupMessages({ id: roomId, ...(before ? { before } : {}), limit: PAGE_SIZE })
      return api.cleanupMessages({ cleanupId: roomId, ...(before ? { before } : {}), limit: PAGE_SIZE })
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: false,
    staleTime: 10_000,
    gcTime: 5 * 60_000,
  })

  const [liveMessages, setLiveMessages] = useState<ChatMessageDTO[]>([])
  const [outbox, setOutbox] = useState<OutboxEntry[]>([])
  const [aroundWindow, setAroundWindow] = useState<ChatItem[] | null>(null)
  const [aroundLoading, setAroundLoading] = useState(false)
  const aroundSeqRef = useRef(0)
  const roomGenerationRef = useRef(0)
  const aroundCursorsRef = useRef<{ next: string | null; prev: string | null } | null>(null)
  const [connection, setConnection] = useState<ChatConnState>(socket.getStatus())
  const [joinRejected, setJoinRejected] = useState<ChatRoomError | null>(null)
  const [transientError, setTransientError] = useState<ChatRoomError | null>(null)

  const [typingUserIds, setTypingUserIds] = useState<string[]>([])
  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const lastTypingSentRef = useRef(0)

  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(() => new Set())

  const sendTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const readAckTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastAckedIdRef = useRef<string | null>(null)
  const pendingAckRef = useRef<PendingReadAck | null>(null)
  const wasOpenRef = useRef(false)
  const replayOnReconnectRef = useRef<() => void>(() => {})
  const patchMessageRef = useRef<(messageId: string, patch: Partial<ChatMessageDTO>) => void>(() => {})
  const outboxMentionsRef = useRef<Map<string, string[]>>(new Map())
  const offlineFailedRef = useRef<Set<string>>(new Set())
  const coreQueuedRef = useRef<Set<string>>(new Set())
  const cacheOpsRef = useRef<HistoryCacheOp[]>([])
  const liveMessagesRef = useRef<ChatMessageDTO[]>([])
  const outboxRef = useRef<OutboxEntry[]>([])
  const aroundWindowRef = useRef<ChatItem[] | null>(null)

  useLayoutEffect(() => {
    liveMessagesRef.current = liveMessages
    outboxRef.current = outbox
    aroundWindowRef.current = aroundWindow
  }, [liveMessages, outbox, aroundWindow])

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

  const clearSendTimer = useCallback((clientId: string) => {
    const timer = sendTimers.current.get(clientId)
    if (timer) {
      clearTimeout(timer)
      sendTimers.current.delete(clientId)
    }
  }, [])

  const clearTypingState = useCallback(() => {
    for (const timer of typingTimers.current.values()) clearTimeout(timer)
    typingTimers.current.clear()
    setTypingUserIds([])
  }, [])

  const markTyping = useCallback((userId: string) => {
    const existing = typingTimers.current.get(userId)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      typingTimers.current.delete(userId)
      setTypingUserIds((prev) => prev.filter((id) => id !== userId))
    }, TYPING_EXPIRY_MS)
    typingTimers.current.set(userId, timer)
    setTypingUserIds((prev) => (prev.includes(userId) ? prev : [...prev, userId]))
  }, [])

  const clearTypingFor = useCallback((userId: string) => {
    const existing = typingTimers.current.get(userId)
    if (existing) {
      clearTimeout(existing)
      typingTimers.current.delete(userId)
    }
    setTypingUserIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : prev))
  }, [])

  const inboundBuffer = useRef<InboundFrame[]>([])
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isHistoryFetchInFlight = useCallback(() => {
    const state = queryClient.getQueryState(queryKeys.chatHistory(roomId, roomKind))
    return state !== undefined && state.fetchStatus !== "idle"
  }, [queryClient, roomId, roomKind])

  const pruneLiveMessages = useCallback((folded: ReadonlySet<string>) => {
    if (folded.size === 0) return
    setLiveMessages((prev) => {
      if (prev.length === 0) return prev
      const next = prev.filter(
        (m) => !folded.has(m.id) && !(m.clientId !== undefined && folded.has(m.clientId)),
      )
      return next.length === prev.length ? prev : next
    })
  }, [])

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

  const reconcile = useCallback(
    (message: ChatMessageDTO, explicitClientId?: string, viewerTruth?: boolean) => {
      const cid = effectiveClientId(message, explicitClientId)
      if (cid) {
        linkLocalChatAttachments(cid, message.id)
        clearSendTimer(cid)
        outboxMentionsRef.current.delete(cid)
        offlineFailedRef.current.delete(cid)
        coreQueuedRef.current.delete(cid)
      }
      inboundBuffer.current.push({ message, explicitClientId, viewerTruth })
      if (flushTimer.current === null) flushTimer.current = setTimeout(flushInbound, 50)
    },
    [clearSendTimer, flushInbound],
  )

  useEffect(() => {
    if (!enabled) {
      setConnection("closed")
      return
    }

    setJoinRejected(null)
    setTransientError(null)
    lastAckedIdRef.current = null
    pendingAckRef.current = null
    const timers = sendTimers.current

    socket.retain()
    const offStatus = socket.onStatus((status) => setConnection(status))

    const offMessage = socket.subscribe((frame) => {
      switch (frame.type) {
        case "message":
          if (frame.message.cleanupId === roomId) {
            if (frame.message.from) clearTypingFor(frame.message.from.id)
            reconcile(frame.message)
          }
          break
        case "ack":
          if (frame.message.cleanupId === roomId) reconcile(frame.message, frame.clientId, true)
          break
        case "message_update":
          if (frame.roomId === roomId && frame.roomKind === roomKind) {
            reconcile(frame.message)
            setAroundWindow((prev) => {
              if (!prev) return prev
              const local = prev.find((it) => it.message.id === frame.message.id)?.message
              return applyUpdatesToWindow(prev, [
                local ? preserveViewerFields(local, frame.message) : frame.message,
              ])
            })
          }
          break
        case "reaction":
          if (frameInRoom(frame, roomId, roomKind)) {
            const local = findMessage(frame.message.id)
            if (local) {
              patchMessageRef.current(frame.message.id, preserveViewerFields(local, frame.message))
            }
          }
          break
        case "presence_snapshot":
          if (frameInRoom(frame, roomId, roomKind)) setOnlineUserIds(new Set(frame.userIds))
          break
        case "presence":
          if (frameInRoom(frame, roomId, roomKind)) {
            setOnlineUserIds((prev) => {
              const next = new Set(prev)
              if (frame.state === "join") next.add(frame.userId)
              else next.delete(frame.userId)
              return next
            })
          }
          break
        case "typing":
          if (frameInRoom(frame, roomId, roomKind) && frame.userId !== myUserId) markTyping(frame.userId)
          break
        case "error":
          if (frameInRoom(frame, roomId, roomKind)) {
            if (isFatalRoomErrorCode(frame.code)) {
              socket.markRoomRejected(roomId, roomKind)
              setJoinRejected({ code: frame.code, message: frame.message })
            } else {
              if (isSendRejectionErrorCode(frame.code)) {
                const isAffected = (e: OutboxEntry): boolean =>
                  e.status === "sending" && !coreQueuedRef.current.has(e.clientId)
                for (const entry of outboxRef.current) {
                  if (isAffected(entry)) {
                    clearSendTimer(entry.clientId)
                    offlineFailedRef.current.delete(entry.clientId)
                  }
                }
                setOutbox((prev) =>
                  prev.some(isAffected)
                    ? prev.map((e) => (isAffected(e) ? { ...e, status: "failed" } : e))
                    : prev,
                )
              }
              setTransientError({ code: frame.code, message: frame.message })
            }
          }
          break
        case "signal":
          break
        default:
          break
      }
    })

    socket.join(roomId, roomKind)

    return () => {
      offStatus()
      offMessage()
      const flushUpToId = readAckToFlush(pendingAckRef.current, roomId, roomKind)
      if (flushUpToId !== null) {
        pendingAckRef.current = null
        lastAckedIdRef.current = flushUpToId
        socket.send({
          type: "ack",
          upToId: flushUpToId,
          cleanupId: roomId,
          ...(stampRoomKind ? { roomKind } : {}),
        })
        void queryClient.invalidateQueries({ queryKey: queryKeys.threads })
      }
      socket.leave(roomId, roomKind)
      socket.release()
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
      if (flushTimer.current !== null) {
        clearTimeout(flushTimer.current)
        flushTimer.current = null
      }
      inboundBuffer.current = []
    }
  }, [
    roomId,
    roomKind,
    stampRoomKind,
    enabled,
    socket,
    reconcile,
    markTyping,
    clearTypingFor,
    findMessage,
    clearSendTimer,
    myUserId,
    queryClient,
  ])

  useEffect(() => {
    setLiveMessages([])
    setOutbox([])
    outboxMentionsRef.current.clear()
    offlineFailedRef.current.clear()
    coreQueuedRef.current.clear()
    cacheOpsRef.current = []
    roomGenerationRef.current++
    setTransientError(null)
    setOnlineUserIds(new Set())
    clearTypingState()
    aroundSeqRef.current++
    aroundCursorsRef.current = null
    setAroundWindow(null)
    setAroundLoading(false)
  }, [roomId, roomKind, clearTypingState])

  useEffect(() => {
    const timers = typingTimers.current
    return () => {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
    }
  }, [])

  const armSendTimeout = useCallback(
    (clientId: string, timeoutMs: number = SEND_TIMEOUT_MS) => {
      clearSendTimer(clientId)
      const timer = setTimeout(() => {
        sendTimers.current.delete(clientId)
        setOutbox((prev) =>
          prev.map((e) => (e.clientId === clientId ? { ...e, status: "failed" } : e)),
        )
      }, timeoutMs)
      sendTimers.current.set(clientId, timer)
    },
    [clearSendTimer],
  )

  const dispatch = useCallback(
    (clientId: string, body: string, mentionedUserIds?: string[], mediaUploadIds?: string[], replyToId?: string) => {
      if (coreQueuedRef.current.has(clientId)) {
        armSendTimeout(clientId, QUEUED_SEND_TIMEOUT_MS)
        return
      }
      const outcome = chatSendOutcome(
        socket.send({
          type: "send",
          cleanupId: roomId,
          ...(stampRoomKind ? { roomKind } : {}),
          clientId,
          body,
          ...(mentionedUserIds && mentionedUserIds.length > 0 ? { mentionedUserIds } : {}),
          ...(mediaUploadIds && mediaUploadIds.length > 0 ? { mediaUploadIds } : {}),
          ...(replyToId ? { replyToId } : {}),
        }),
      )
      if (outcome === "sent") {
        coreQueuedRef.current.delete(clientId)
        offlineFailedRef.current.delete(clientId)
        armSendTimeout(clientId)
        return
      }
      if (outcome === "queued") {
        coreQueuedRef.current.add(clientId)
        offlineFailedRef.current.delete(clientId)
        armSendTimeout(clientId, QUEUED_SEND_TIMEOUT_MS)
        return
      }
      clearSendTimer(clientId)
      coreQueuedRef.current.delete(clientId)
      offlineFailedRef.current.add(clientId)
      setOutbox((prev) =>
        prev.map((e) => (e.clientId === clientId ? { ...e, status: "failed" } : e)),
      )
    },
    [socket, roomId, roomKind, stampRoomKind, armSendTimeout, clearSendTimer],
  )

  const mediaIdsOf = (entry: OutboxEntry): string[] =>
    (entry.message.attachments ?? []).map((m) => m.id)

  const refreshNewestPage = useCallback(() => {
    if (!canReadHistory) return
    const key = queryKeys.chatHistory(roomId, roomKind)
    const existing = queryClient.getQueryData<ChatHistoryData>(key)
    if (!existing || existing.pages.length === 0) return
    const generation = roomGenerationRef.current
    const req = isDm
      ? api.dmMessages({ threadId: roomId, limit: PAGE_SIZE })
      : isReport
        ? api.reportMessages({ id: roomId, limit: PAGE_SIZE })
        : isGroup
          ? api.groupMessages({ id: roomId, limit: PAGE_SIZE })
          : api.cleanupMessages({ cleanupId: roomId, limit: PAGE_SIZE })
    req
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
  }, [api, canReadHistory, isDm, isReport, isGroup, queryClient, roomId, roomKind, isHistoryFetchInFlight])

  // The reconnect effect is keyed on the connection edge alone; the replay reads the outbox, history and
  // senders of the last committed render through this ref instead of re-running on each of them.
  useLayoutEffect(() => {
    replayOnReconnectRef.current = () => {
      const replay = replayableEntries(outbox, offlineFailedRef.current, coreQueuedRef.current)
      // Captured now: dispatch() below clears offlineFailedRef before this updater runs.
      const resend = new Set(replay.filter((e) => e.status === "failed").map((e) => e.clientId))
      if (resend.size > 0) setOutbox((prev) => markResending(prev, resend))
      for (const entry of replay) {
        dispatch(
          entry.clientId,
          entry.message.body ?? "",
          outboxMentionsRef.current.get(entry.clientId),
          mediaIdsOf(entry),
          entry.message.replyToId ?? undefined,
        )
      }
      for (const clientId of coreQueuedRef.current) armSendTimeout(clientId)
      coreQueuedRef.current.clear()
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

  const send = useCallback(
    (raw: string, mentionedUserIds?: string[], media?: ComposerMedia[], replyToId?: string) => {
      const body = raw.trim()
      const mediaList = media ?? []
      if ((!body && mediaList.length === 0) || !enabled) return
      setTransientError(null)
      const clientId = newClientId()
      let replyTo: ReplyToDTO | undefined
      if (replyToId) {
        const quoted = findMessage(replyToId)
        if (quoted) replyTo = buildLocalReplyTo(quoted)
      }
      const attachments: MediaDTO[] = mediaList.map((m) => ({
        id: m.uploadId,
        kind: m.kind,
        url: m.localUri,
        thumbUrl: m.posterUri ?? null,
        status: "validating",
      }))
      const optimistic: ChatMessageDTO = {
        id: clientId,
        cleanupId: roomId,
        from: {
          id: myUserId ?? "me",
          name: user?.displayName ?? "You",
          avatar: null,
          followers: 0,
          following: 0,
          isFollowing: false,
        },
        body,
        kind: "text",
        attachments,
        reactions: [],
        mentions: [],
        createdAt: new Date().toISOString(),
        clientId,
        ...(replyToId ? { replyToId, ...(replyTo ? { replyTo } : {}) } : {}),
      }
      rememberLocalChatAttachments(clientId, attachments)
      setOutbox((prev) => [...prev, { clientId, message: optimistic, status: "sending" }])
      if (mentionedUserIds && mentionedUserIds.length > 0) {
        outboxMentionsRef.current.set(clientId, mentionedUserIds)
      }
      dispatch(clientId, body, mentionedUserIds, mediaList.map((m) => m.uploadId), replyToId)
    },
    [enabled, roomId, myUserId, user?.displayName, dispatch, findMessage],
  )

  const retry = useCallback(
    (clientId: string) => {
      const entry = outboxRef.current.find((e) => e.clientId === clientId)
      if (!entry) return
      setTransientError(null)
      setOutbox((prev) =>
        prev.map((e) => (e.clientId === clientId ? { ...e, status: "sending" } : e)),
      )
      dispatch(
        clientId,
        entry.message.body ?? "",
        outboxMentionsRef.current.get(clientId),
        mediaIdsOf(entry),
        entry.message.replyToId ?? undefined,
      )
    },
    [dispatch],
  )

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

  useLayoutEffect(() => {
    patchMessageRef.current = patchMessage
  }, [patchMessage])

  useEffect(() => {
    if (!history.isFetching) drainCacheOps()
  }, [history.isFetching, drainCacheOps])

  const toggleReaction = useCallback(
    (messageId: string, emoji: ReactionEmoji) => {
      const prior = findMessage(messageId)
      if (!prior) return
      const snapshot: Pick<ChatMessageDTO, "reactions"> = { reactions: prior.reactions }

      patchMessage(messageId, { reactions: toggleReactionBucket(prior.reactions, emoji) })

      const req =
        roomKind === "group"
          ? api.toggleMessageReaction({ roomKind: "group", roomId, messageId, emoji })
          : isDm
            ? api.toggleDmMessageReaction({ threadId: roomId, messageId, emoji })
            : isReport
              ? api.toggleReportMessageReaction({ id: roomId, messageId, emoji })
              : api.toggleCleanupMessageReaction({ cleanupId: roomId, messageId, emoji })
      req
        .then((updated) => {
          if (updated && updated.id === messageId) patchMessage(messageId, { reactions: updated.reactions })
        })
        .catch(() => {
          patchMessage(messageId, snapshot)
        })
    },
    [api, isDm, isReport, roomId, roomKind, findMessage, patchMessage],
  )

  const edit = useCallback(
    async (messageId: string, rawBody: string, mentionedUserIds?: string[]): Promise<void> => {
      const body = rawBody.trim()
      if (!body) throw new AppError(ErrorCode.VALIDATION, "Message cannot be empty.")

      const prior = findMessage(messageId)
      if (!prior) throw new AppError(ErrorCode.NOT_FOUND, "That message is no longer available.")
      const snapshot = { body: prior.body, editedAt: prior.editedAt }

      patchMessage(messageId, { body, editedAt: new Date().toISOString() })

      try {
        const mentions =
          mentionedUserIds && mentionedUserIds.length > 0 ? { mentionedUserIds } : {}
        const updated = isDm
          ? await api.editDmMessage({ threadId: roomId, messageId, body, ...mentions })
          : await api.editChatMessage({ roomKind, roomId, messageId, body, ...mentions })
        if (updated && updated.id === messageId) patchMessage(messageId, updated)
      } catch (err) {
        patchMessage(messageId, snapshot)
        throw err
      }
    },
    [isDm, api, roomId, roomKind, findMessage, patchMessage],
  )

  const deleteMessage = useCallback(
    async (messageId: string): Promise<void> => {
      const prior = findMessage(messageId)
      if (!prior) throw new AppError(ErrorCode.NOT_FOUND, "That message is no longer available.")
      const snapshot = { body: prior.body, deletedAt: prior.deletedAt }

      patchMessage(messageId, { body: "", deletedAt: new Date().toISOString() })

      try {
        const updated = isDm
          ? await api.deleteDmMessage({ threadId: roomId, messageId })
          : isReport
            ? await api.deleteReportMessage({ id: roomId, messageId })
            : isGroup
              ? await api.deleteGroupMessage({ id: roomId, messageId })
              : await api.deleteCleanupMessage({ cleanupId: roomId, messageId })
        if (updated && updated.id === messageId) patchMessage(messageId, updated)
      } catch (err) {
        patchMessage(messageId, snapshot)
        throw err
      }
    },
    [isDm, isReport, isGroup, api, roomId, findMessage, patchMessage],
  )

  const setPinned = useCallback(
    async (messageId: string, pinned: boolean): Promise<void> => {
      const prior = findMessage(messageId, true)
      if (!prior) throw new AppError(ErrorCode.NOT_FOUND, "That message is no longer available.")
      const snapshot: Pick<ChatMessageDTO, "pinnedAt"> = { pinnedAt: prior.pinnedAt ?? null }

      patchMessage(messageId, { pinnedAt: pinned ? new Date().toISOString() : null })

      try {
        const updated = await api.setMessagePinned({ roomKind, roomId, messageId, pinned })
        if (updated && updated.id === messageId) patchMessage(messageId, updated)
      } catch (err) {
        patchMessage(messageId, snapshot)
        throw err
      }
    },
    [api, roomId, roomKind, findMessage, patchMessage],
  )

  const createPoll = useCallback(
    async (input: { question: string; options: string[]; allowMultiple: boolean; anonymous: boolean }): Promise<void> => {
      if (isDm) throw new AppError(ErrorCode.VALIDATION, "Polls are not available in direct messages.")
      const msg = await api.createPoll({
        roomKind: roomKind as "cleanup" | "report" | "group",
        roomId,
        question: input.question,
        options: input.options,
        allowMultiple: input.allowMultiple,
        anonymous: input.anonymous,
      })
      reconcile(msg)
    },
    [api, isDm, roomKind, roomId, reconcile],
  )

  const votePoll = useCallback(
    async (messageId: string, optionIdxs: number[]): Promise<void> => {
      const prior = findMessage(messageId)
      if (!prior || !prior.poll) throw new AppError(ErrorCode.NOT_FOUND, "That poll is no longer available.")
      const snapshot: Pick<ChatMessageDTO, "poll"> = { poll: prior.poll }
      const hadVoted = prior.poll.myVote.length > 0

      patchMessage(messageId, { poll: applyVoteLocally(prior.poll, optionIdxs, hadVoted) })

      try {
        const updated = await api.votePoll({ messageId, optionIdxs })
        if (updated && updated.id === messageId) patchMessage(messageId, updated)
      } catch (err) {
        patchMessage(messageId, snapshot)
        throw err
      }
    },
    [api, findMessage, patchMessage],
  )

  const closePoll = useCallback(
    async (messageId: string): Promise<void> => {
      const updated = await api.closePoll({ messageId })
      if (updated && updated.id === messageId) patchMessage(messageId, updated)
    },
    [api, patchMessage],
  )

  const fetchAround = useCallback(
    (messageId: string) => {
      const seq = ++aroundSeqRef.current
      setAroundLoading(true)
      const req = isDm
        ? api.dmMessages({ threadId: roomId, around: messageId, limit: PAGE_SIZE })
        : isReport
          ? api.reportMessages({ id: roomId, around: messageId, limit: PAGE_SIZE })
          : isGroup
            ? api.groupMessages({ id: roomId, around: messageId, limit: PAGE_SIZE })
            : api.cleanupMessages({ cleanupId: roomId, around: messageId, limit: PAGE_SIZE })
      return req
        .then((page) => {
          if (seq !== aroundSeqRef.current) return true
          const items = page.items.filter((m) => m.cleanupId === roomId)
          aroundCursorsRef.current = { next: page.nextCursor ?? null, prev: page.prevCursor ?? null }
          setAroundWindow(restoreLocalChatAttachments(mergeChatItems(items, [], [], myUserId)))
          setAroundLoading(false)
          return true
        })
        .catch(() => {
          if (seq !== aroundSeqRef.current) return true
          setAroundLoading(false)
          return false
        })
    },
    [api, isDm, isReport, isGroup, roomId, myUserId],
  )

  const clearAround = useCallback(() => {
    aroundSeqRef.current++
    aroundCursorsRef.current = null
    setAroundWindow(null)
    setAroundLoading(false)
  }, [])

  const sendTyping = useCallback(() => {
    if (!enabled) return
    const now = Date.now()
    if (now - lastTypingSentRef.current < TYPING_THROTTLE_MS) return
    lastTypingSentRef.current = now
    socket.send({ type: "typing", cleanupId: roomId, ...(stampRoomKind ? { roomKind } : {}) })
  }, [enabled, socket, roomId, roomKind, stampRoomKind])

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

  const sendReadAck = useCallback(
    (upToId: string) => {
      if (lastAckedIdRef.current === upToId) return
      lastAckedIdRef.current = upToId
      pendingAckRef.current = null
      socket.send({ type: "ack", upToId, cleanupId: roomId, ...(stampRoomKind ? { roomKind } : {}) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.threads })
    },
    [socket, roomId, roomKind, stampRoomKind, queryClient],
  )

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
    sendTyping,
    typingUserIds,
    onlineCount: myUserId && onlineUserIds.has(myUserId) ? onlineUserIds.size - 1 : onlineUserIds.size,
    aroundWindow,
    aroundLoading,
    fetchAround,
    clearAround,
  }
}
