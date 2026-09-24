import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react"
import { preserveViewerFields, type ChatItem, type ChatMessageDTO, type RoomKind } from "@civfix/shared"
import { applyUpdatesToWindow } from "../aroundWindow"
import { frameInRoom, isFatalRoomErrorCode, isSendRejectionErrorCode } from "../inbound"
import type { ChatConnState, ChatSocketLike } from "../types"
import { withPresenceChange } from "./chatPresence"
import type { ChatRoomError } from "./chatRoom"

export interface ChatRoomSocketDeps {
  socket: ChatSocketLike
  roomId: string
  roomKind: RoomKind
  enabled: boolean
  myUserId: string | null
  setConnection: Dispatch<SetStateAction<ChatConnState>>
  setJoinRejected: Dispatch<SetStateAction<ChatRoomError | null>>
  setTransientError: Dispatch<SetStateAction<ChatRoomError | null>>
  setOnlineUserIds: Dispatch<SetStateAction<Set<string>>>
  setAroundWindow: Dispatch<SetStateAction<ChatItem[] | null>>
  patchMessageRef: MutableRefObject<(messageId: string, patch: Partial<ChatMessageDTO>) => void>
  findMessage: (messageId: string) => ChatMessageDTO | undefined
  reconcile: (message: ChatMessageDTO, explicitClientId?: string, viewerTruth?: boolean) => void
  discardPendingInbound: () => void
  markTyping: (userId: string) => void
  clearTypingFor: (userId: string) => void
  failInFlightSends: () => void
  clearAllSendTimers: () => void
  resetReadAck: () => void
  flushPendingReadAck: () => void
}

/**
 * Joins the room on the shared socket and routes its frames. Teardown flushes the room's pending read
 * watermark before leaving, so it must stay the first passive effect `useChat` declares.
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
  setOnlineUserIds,
  setAroundWindow,
  patchMessageRef,
  findMessage,
  reconcile,
  discardPendingInbound,
  markTyping,
  clearTypingFor,
  failInFlightSends,
  clearAllSendTimers,
  resetReadAck,
  flushPendingReadAck,
}: ChatRoomSocketDeps): void {
  useEffect(() => {
    if (!enabled) {
      setConnection("closed")
      return
    }

    setJoinRejected(null)
    setTransientError(null)
    resetReadAck()

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
      socket.release()
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
    patchMessageRef,
    failInFlightSends,
    clearAllSendTimers,
    resetReadAck,
    flushPendingReadAck,
  ])
}
