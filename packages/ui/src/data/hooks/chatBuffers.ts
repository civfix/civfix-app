import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react"
import type { ChatItem, ChatMessageDTO, OutboxEntry } from "@civfix/shared"

export interface ChatBuffers {
  liveMessages: ChatMessageDTO[]
  setLiveMessages: Dispatch<SetStateAction<ChatMessageDTO[]>>
  liveMessagesRef: MutableRefObject<ChatMessageDTO[]>
  outbox: OutboxEntry[]
  setOutbox: Dispatch<SetStateAction<OutboxEntry[]>>
  outboxRef: MutableRefObject<OutboxEntry[]>
  aroundWindow: ChatItem[] | null
  setAroundWindow: Dispatch<SetStateAction<ChatItem[] | null>>
  aroundWindowRef: MutableRefObject<ChatItem[] | null>
  pruneLiveMessages: (folded: ReadonlySet<string>) => void
}

/**
 * The three message buffers a chat room renders from besides the history cache: live frames not yet
 * folded into history, the local outbox and the jump-to-message window. Socket handlers and callbacks
 * read them through refs synced after every commit.
 */
export function useChatBuffers(): ChatBuffers {
  const [liveMessages, setLiveMessages] = useState<ChatMessageDTO[]>([])
  const [outbox, setOutbox] = useState<OutboxEntry[]>([])
  const [aroundWindow, setAroundWindow] = useState<ChatItem[] | null>(null)
  const liveMessagesRef = useRef<ChatMessageDTO[]>([])
  const outboxRef = useRef<OutboxEntry[]>([])
  const aroundWindowRef = useRef<ChatItem[] | null>(null)

  useLayoutEffect(() => {
    liveMessagesRef.current = liveMessages
    outboxRef.current = outbox
    aroundWindowRef.current = aroundWindow
  }, [liveMessages, outbox, aroundWindow])

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

  return {
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
  }
}
