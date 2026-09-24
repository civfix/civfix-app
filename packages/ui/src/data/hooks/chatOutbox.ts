import { useCallback, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react"
import type { ChatMessageDTO, MediaDTO, OutboxEntry, ReplyToDTO, RoomKind, UserDTO } from "@civfix/shared"
import { replayableEntries } from "../inbound"
import { randomId } from "../randomId"
import { rememberLocalChatAttachments } from "../localChatAttachments"
import { buildLocalReplyTo } from "../replyPreview"
import { chatSendOutcome, type ChatSocketLike } from "../types"
import type { ChatRoomError, ComposerMedia } from "./chatRoom"

export const SEND_TIMEOUT_MS = 12_000
export const QUEUED_SEND_TIMEOUT_MS = 5 * SEND_TIMEOUT_MS

function mediaIdsOf(entry: OutboxEntry): string[] {
  return (entry.message.attachments ?? []).map((m) => m.id)
}

export function markResending(outbox: OutboxEntry[], clientIds: ReadonlySet<string>): OutboxEntry[] {
  if (clientIds.size === 0) return outbox
  return outbox.map((e) =>
    e.status === "failed" && clientIds.has(e.clientId) ? { ...e, status: "sending" } : e,
  )
}

export interface ChatOutboxDeps {
  socket: ChatSocketLike
  roomId: string
  roomKind: RoomKind
  stampRoomKind: boolean
  enabled: boolean
  myUserId: string | null
  user: UserDTO | null
  outbox: OutboxEntry[]
  outboxRef: MutableRefObject<OutboxEntry[]>
  setOutbox: Dispatch<SetStateAction<OutboxEntry[]>>
  setTransientError: Dispatch<SetStateAction<ChatRoomError | null>>
  findMessage: (messageId: string) => ChatMessageDTO | undefined
}

/**
 * The optimistic send pipeline: every outbox entry is either awaiting its ack under a timeout, queued by
 * the socket core while it is closed (`coreQueuedRef`), or failed because the socket dropped it offline
 * (`offlineFailedRef`), which is what the reconnect replay re-sends.
 */
export function useChatOutbox({
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
}: ChatOutboxDeps) {
  const sendTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const outboxMentionsRef = useRef<Map<string, string[]>>(new Map())
  const offlineFailedRef = useRef<Set<string>>(new Set())
  const coreQueuedRef = useRef<Set<string>>(new Set())

  const clearSendTimer = useCallback((clientId: string) => {
    const timer = sendTimers.current.get(clientId)
    if (timer) {
      clearTimeout(timer)
      sendTimers.current.delete(clientId)
    }
  }, [])

  const clearAllSendTimers = useCallback(() => {
    const timers = sendTimers.current
    for (const timer of timers.values()) clearTimeout(timer)
    timers.clear()
  }, [])

  const settleSend = useCallback(
    (clientId: string) => {
      clearSendTimer(clientId)
      outboxMentionsRef.current.delete(clientId)
      offlineFailedRef.current.delete(clientId)
      coreQueuedRef.current.delete(clientId)
    },
    [clearSendTimer],
  )

  const resetSendTracking = useCallback(() => {
    outboxMentionsRef.current.clear()
    offlineFailedRef.current.clear()
    coreQueuedRef.current.clear()
  }, [])

  const failInFlightSends = useCallback(() => {
    const isAffected = (e: OutboxEntry): boolean =>
      e.status === "sending" && !coreQueuedRef.current.has(e.clientId)
    for (const entry of outboxRef.current) {
      if (!isAffected(entry)) continue
      clearSendTimer(entry.clientId)
      offlineFailedRef.current.delete(entry.clientId)
    }
    setOutbox((prev) =>
      prev.some(isAffected)
        ? prev.map((e) => (isAffected(e) ? { ...e, status: "failed" } : e))
        : prev,
    )
  }, [clearSendTimer, outboxRef, setOutbox])

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

  const redispatch = useCallback(
    (entry: OutboxEntry) => {
      dispatch(
        entry.clientId,
        entry.message.body ?? "",
        outboxMentionsRef.current.get(entry.clientId),
        mediaIdsOf(entry),
        entry.message.replyToId ?? undefined,
      )
    },
    [dispatch],
  )

  // Reads this render's outbox, so it is only ever called from the reconnect replay that a layout effect
  // installs for the last committed render.
  const replayOutbox = () => {
    const replay = replayableEntries(outbox, offlineFailedRef.current, coreQueuedRef.current)
    // Captured now: dispatch() below clears offlineFailedRef before this updater runs.
    const resend = new Set(replay.filter((e) => e.status === "failed").map((e) => e.clientId))
    if (resend.size > 0) setOutbox((prev) => markResending(prev, resend))
    for (const entry of replay) redispatch(entry)
    for (const clientId of coreQueuedRef.current) armSendTimeout(clientId)
    coreQueuedRef.current.clear()
  }

  const send = useCallback(
    (raw: string, mentionedUserIds?: string[], media?: ComposerMedia[], replyToId?: string) => {
      const body = raw.trim()
      const mediaList = media ?? []
      if ((!body && mediaList.length === 0) || !enabled) return
      setTransientError(null)
      const clientId = randomId()
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
      redispatch(entry)
    },
    [redispatch],
  )

  return {
    send,
    retry,
    replayOutbox,
    settleSend,
    clearAllSendTimers,
    resetSendTracking,
    failInFlightSends,
  }
}
