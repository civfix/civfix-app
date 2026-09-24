import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { Platform } from "react-native"
import type { FlatList as RNFlatList, NativeScrollEvent, NativeSyntheticEvent } from "react-native"
import type { ChatItem } from "@civfix/shared"
import { space } from "../../theme"
import { getScrollableNode, type RenderItem } from "./conversationModel"

export function useTranscriptScroll(items: ChatItem[], clearAround: () => void) {
  const listRef = useRef<RNFlatList<RenderItem> | null>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [hasNewBelow, setHasNewBelow] = useState(false)
  const savedDistanceRef = useRef<number | null>(null)

  const scrollToBottom = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true })
    setHasNewBelow(false)
  }, [])

  const backToLatest = useCallback(() => {
    clearAround()
    setHasNewBelow(false)
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: false }))
  }, [clearAround])

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y
    const atBottom = y <= space["10"]
    setIsAtBottom(atBottom)
    if (atBottom) setHasNewBelow(false)
    if (Platform.OS === "web") {
      const node = getScrollableNode(listRef.current)
      if (node) savedDistanceRef.current = node.scrollHeight - node.scrollTop
    }
  }, [])

  const newestId = useMemo(() => {
    const last = items[items.length - 1]
    return last ? { id: last.message.clientId ?? last.message.id, mine: last.mine } : null
  }, [items])
  const prevNewestIdRef = useRef<string | null>(null)
  useEffect(() => {
    const prev = prevNewestIdRef.current
    prevNewestIdRef.current = newestId?.id ?? null
    if (prev === null) return
    if (newestId && newestId.id !== prev && !newestId.mine && !isAtBottom) {
      setHasNewBelow(true)
    }
  }, [newestId, isAtBottom])

  const oldestId = items.length > 0 ? (items[0]!.message.clientId ?? items[0]!.message.id) : null
  const prevOldestIdRef = useRef<string | null>(oldestId)
  useLayoutEffect(() => {
    if (Platform.OS !== "web") return
    const prev = prevOldestIdRef.current
    prevOldestIdRef.current = oldestId
    if (prev === null || oldestId === null || oldestId === prev) return
    const saved = savedDistanceRef.current
    if (saved == null) return
    const raf = requestAnimationFrame(() => {
      const node = getScrollableNode(listRef.current)
      if (node) node.scrollTop = node.scrollHeight - saved
    })
    return () => cancelAnimationFrame(raf)
  }, [oldestId])

  return { listRef, hasNewBelow, scrollToBottom, backToLatest, onScroll }
}
