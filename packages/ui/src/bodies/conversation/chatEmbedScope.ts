import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from "react"
import {
  createEmbedLoadQueue,
  createEmbedViewport,
  createOpenViewport,
  type EmbedLoadQueue,
  type EmbedViewport,
} from "./embedScheduler"

export interface ChatEmbedScope {
  queue: EmbedLoadQueue
  viewport: EmbedViewport
}

const ChatEmbedScopeContext = createContext<ChatEmbedScope | null>(null)
ChatEmbedScopeContext.displayName = "ChatEmbedScopeContext"

export const ChatEmbedScopeProvider = ChatEmbedScopeContext.Provider

function useChatEmbedScope(): ChatEmbedScope {
  const provided = useContext(ChatEmbedScopeContext)
  const unscoped = useRef<ChatEmbedScope | null>(null)
  if (provided) return provided
  unscoped.current ??= { queue: createEmbedLoadQueue(), viewport: createOpenViewport() }
  return unscoped.current
}

export function useOwnChatEmbedScope(): ChatEmbedScope {
  return useMemo(() => ({ queue: createEmbedLoadQueue(), viewport: createEmbedViewport() }), [])
}

export interface EmbedGate {
  ready: boolean
  onSettled: (cached: boolean) => void
}

export function useEmbedGate(rowKey: string, embedKey: string): EmbedGate {
  const { queue, viewport } = useChatEmbedScope()
  const readVisible = useCallback(() => viewport.isVisible(rowKey), [viewport, rowKey])
  const visible = useSyncExternalStore(
    useCallback((listener: () => void) => viewport.subscribe(rowKey, listener), [viewport, rowKey]),
    readVisible,
    readVisible,
  )
  const readAdmitted = useCallback(() => queue.isAdmitted(embedKey), [queue, embedKey])
  const admitted = useSyncExternalStore(
    useCallback((listener: () => void) => queue.subscribe(embedKey, listener), [queue, embedKey]),
    readAdmitted,
    readAdmitted,
  )
  useEffect(() => {
    if (!visible) return
    queue.request(embedKey)
    return () => queue.drop(embedKey)
  }, [queue, embedKey, visible])
  const onSettled = useCallback((cached: boolean) => queue.settle(embedKey, cached), [queue, embedKey])
  return { ready: visible && admitted, onSettled }
}
