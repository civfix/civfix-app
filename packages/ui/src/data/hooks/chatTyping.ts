import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react"
import type { RoomKind } from "@civfix/shared"
import type { ChatSocketLike } from "../types"

const TYPING_THROTTLE_MS = 2_000
const TYPING_EXPIRY_MS = 5_000

type TimerMap = Map<string, ReturnType<typeof setTimeout>>

export interface ChatTypingDeps {
  socket: ChatSocketLike
  roomId: string
  roomKind: RoomKind
  stampRoomKind: boolean
  enabled: boolean
}

/** Who else is typing (each indicator expires on its own timer), and the throttled outgoing signal. */
export function useChatTyping({ socket, roomId, roomKind, stampRoomKind, enabled }: ChatTypingDeps) {
  const [typingUserIds, setTypingUserIds] = useState<string[]>([])
  const typingTimers = useRef<TimerMap>(new Map())
  const lastTypingSentRef = useRef(0)

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

  const sendTyping = useCallback(() => {
    if (!enabled) return
    const now = Date.now()
    if (now - lastTypingSentRef.current < TYPING_THROTTLE_MS) return
    lastTypingSentRef.current = now
    socket.send({ type: "typing", cleanupId: roomId, ...(stampRoomKind ? { roomKind } : {}) })
  }, [enabled, socket, roomId, roomKind, stampRoomKind])

  return { typingUserIds, typingTimers, clearTypingState, markTyping, clearTypingFor, sendTyping }
}

/** Kept apart from `useChatTyping` so the caller can declare it after the socket lifecycle effect. */
export function useClearTypingTimersOnUnmount(typingTimers: MutableRefObject<TimerMap>): void {
  useEffect(() => {
    const timers = typingTimers.current
    return () => {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
    }
  }, [typingTimers])
}
