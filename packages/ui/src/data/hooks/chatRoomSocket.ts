import { useEffect, type Dispatch, type SetStateAction } from "react"
import { preserveViewerFields, type ChatItem, type RoomKind } from "@civfix/shared"
import { applyUpdatesToWindow } from "../aroundWindow"
import { frameInRoom, isFatalRoomErrorCode, isSendRejectionErrorCode } from "../inbound"
import type { ChatConnState, ChatSocketLike } from "../types"
import type { useChatHistoryCache } from "./chatHistory"
import type { useChatInbound } from "./chatInbound"
import type { useChatOutbox } from "./chatOutbox"
import { withPresenceChange, type useChatPresence } from "./chatPresence"
import type { useChatReadAck } from "./chatReadAck"
import type { ChatRoomError } from "./chatRoom"
import type { useChatTyping } from "./chatTyping"

export interface ChatRoomSocketDeps {
  socket: ChatSocketLike
  roomId: string
  roomKind: RoomKind
  enabled: boolean
  myUserId: string | null
  setConnection: Dispatch<SetStateAction<ChatConnState>>
  setJoinRejected: Dispatch<SetStateAction<ChatRoomError | null>>
  setTransientError: Dispatch<SetStateAction<ChatRoomError | null>>
  setAroundWindow: Dispatch<SetStateAction<ChatItem[] | null>>
  historyCache: Pick<ReturnType<typeof useChatHistoryCache>, "findMessage" | "patchMessage">
  inbound: Pick<ReturnType<typeof useChatInbound>, "reconcile" | "discardPendingInbound">
  typing: Pick<ReturnType<typeof useChatTyping>, "markTyping" | "clearTypingFor">
  presence: Pick<ReturnType<typeof useChatPresence>, "setOnlineUserIds">
  outbox: Pick<ReturnType<typeof useChatOutbox>, "failInFlightSends" | "clearAllSendTimers">
  readAck: Pick<ReturnType<typeof useChatReadAck>, "resetReadAck" | "flushPendingReadAck">
}

/**
 * Joins the room on the shared socket and routes its frames. Teardown flushes the room's pending read
 * watermark before leaving, so `useChat` must declare this effect before its reset and drain effects.
 * The concern objects change identity every render; only their stable members are effect dependencies.
 */
export function useChatRoomSocket({
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
  outbox,
  readAck,
}: ChatRoomSocketDeps): void {
  const { findMessage, patchMessage } = historyCache
  const { reconcile, discardPendingInbound } = inbound
  const { markTyping, clearTypingFor } = typing
  const { setOnlineUserIds } = presence
  const { failInFlightSends, clearAllSendTimers } = outbox
  const { resetReadAck, flushPendingReadAck } = readAck

  useEffect(() => {
    if (!enabled) {
      setConnection("closed")
      return
    }

    setJoinRejected(null)
    setTransientError(null)
    resetReadAck()

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
              patchMessage(frame.message.id, preserveViewerFields(local, frame.message))
            }
          }
          break
        case "presence_snapshot":
          if (frameInRoom(frame, roomId, roomKind)) setOnlineUserIds(new Set(frame.userIds))
          break
        case "presence":
          if (frameInRoom(frame, roomId, roomKind)) {
            setOnlineUserIds((prev) => withPresenceChange(prev, frame.userId, frame.state))
          }
          break
        case "typing":
          if (frameInRoom(frame, roomId, roomKind) && frame.userId !== myUserId) markTyping(frame.userId)
          break
        case "error":
          if (!frameInRoom(frame, roomId, roomKind)) break
          if (isFatalRoomErrorCode(frame.code)) {
            socket.markRoomRejected(roomId, roomKind)
            setJoinRejected({ code: frame.code, message: frame.message })
            break
          }
          if (isSendRejectionErrorCode(frame.code)) failInFlightSends()
          setTransientError({ code: frame.code, message: frame.message })
          break
        default:
          break
      }
    })

    socket.join(roomId, roomKind)

    return () => {
      offStatus()
      offMessage()
      flushPendingReadAck()
      socket.leave(roomId, roomKind)
      clearAllSendTimers()
      discardPendingInbound()
    }
  }, [
    roomId,
    roomKind,
    enabled,
    socket,
    myUserId,
    reconcile,
    discardPendingInbound,
    markTyping,
    clearTypingFor,
    findMessage,
    patchMessage,
    failInFlightSends,
    clearAllSendTimers,
    resetReadAck,
    flushPendingReadAck,
  ])

  // Held apart from the join effect so an in-place room switch is a leave/join on the open socket: under
  // the mobile "eager" policy a release that drops the last hold tears the socket down, so releasing per
  // room would reconnect on every switch. Declared after the join effect so unmount flushes the read
  // watermark and leaves before the release; myUserId stays a key so a new identity still reconnects.
  useEffect(() => {
    if (!enabled) return
    socket.retain()
    return () => socket.release()
  }, [socket, enabled, myUserId])
}
