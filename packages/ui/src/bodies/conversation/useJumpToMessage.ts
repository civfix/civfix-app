import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { FlatList as RNFlatList } from "react-native"
import type { ChatItem } from "@civfix/shared"
import { useToast } from "../../primitives"
import { useT } from "../../i18n"
import { resolveJump } from "../jumpToMessage"
import { FLASH_DURATION_MS } from "./MessageBubble"
import type { RenderItem } from "./conversationModel"

const SCROLL_RETRY_MS = 120

export interface JumpToMessage {
  flashMessageId: string | null
  jumpLoadingId: string | null
  onJumpToMessage: (targetId: string) => void
  onScrollToIndexFailed: (info: { index: number; averageItemLength: number }) => void
}

export function useJumpToMessage({
  listRef,
  roomId,
  data,
  aroundWindow,
  windowRows,
  fetchAround,
}: {
  listRef: React.MutableRefObject<RNFlatList<RenderItem> | null>
  roomId: string
  data: RenderItem[]
  aroundWindow: ChatItem[] | null
  windowRows: RenderItem[] | null
  fetchAround: (messageId: string) => Promise<boolean>
}): JumpToMessage {
  const { t } = useT("conversation")
  const toast = useToast()

  const dataRef = useRef<RenderItem[]>(data)
  useLayoutEffect(() => {
    dataRef.current = data
  })
  const pendingJumpRef = useRef<string | null>(null)

  const [flashMessageId, setFlashMessageId] = useState<string | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashMessage = useCallback((messageId: string) => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    setFlashMessageId(messageId)
    flashTimerRef.current = setTimeout(() => {
      flashTimerRef.current = null
      setFlashMessageId(null)
    }, FLASH_DURATION_MS + 50)
  }, [])

  const scrollRetriedRef = useRef(false)
  const scrollRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollToRow = useCallback(
    (index: number) => {
      scrollRetriedRef.current = false
      listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true })
    },
    [listRef],
  )
  const onScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      listRef.current?.scrollToOffset({ offset: info.index * info.averageItemLength, animated: false })
      if (scrollRetriedRef.current) return
      scrollRetriedRef.current = true
      if (scrollRetryTimerRef.current) clearTimeout(scrollRetryTimerRef.current)
      scrollRetryTimerRef.current = setTimeout(() => {
        scrollRetryTimerRef.current = null
        if (info.index >= dataRef.current.length) return
        listRef.current?.scrollToIndex({ index: info.index, viewPosition: 0.5, animated: true })
      }, SCROLL_RETRY_MS)
    },
    [listRef],
  )

  useEffect(
    () => () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
      if (scrollRetryTimerRef.current) clearTimeout(scrollRetryTimerRef.current)
    },
    [],
  )

  const [jumpLoadingId, setJumpLoadingId] = useState<string | null>(null)

  const activeRoomRef = useRef(roomId)
  useEffect(() => {
    if (activeRoomRef.current === roomId) return
    activeRoomRef.current = roomId
    pendingJumpRef.current = null
    setJumpLoadingId(null)
    if (flashTimerRef.current) {
      clearTimeout(flashTimerRef.current)
      flashTimerRef.current = null
    }
    setFlashMessageId(null)
  }, [roomId])

  const onJumpToMessage = useCallback(
    (targetId: string) => {
      const res = resolveJump(targetId, dataRef.current)
      if (res.type === "scroll") {
        scrollToRow(res.index)
        flashMessage(targetId)
      } else {
        pendingJumpRef.current = targetId
        setJumpLoadingId(targetId)
        void fetchAround(targetId).then((ok) => {
          setJumpLoadingId((cur) => (cur === targetId ? null : cur))
          if (!ok) {
            if (pendingJumpRef.current === targetId) pendingJumpRef.current = null
            toast.show(t("jump.failed"), { variant: "error" })
          }
        })
      }
    },
    [scrollToRow, flashMessage, fetchAround, toast, t],
  )

  useEffect(() => {
    if (!aroundWindow || jumpLoadingId !== null) return
    const target = pendingJumpRef.current
    if (!target) return
    pendingJumpRef.current = null
    const res = windowRows ? resolveJump(target, windowRows) : null
    if (!res || res.type !== "scroll") {
      toast.show(t("jump.failed"), { variant: "error" })
      return
    }
    flashMessage(target)
    const raf = requestAnimationFrame(() => scrollToRow(res.index))
    return () => cancelAnimationFrame(raf)
  }, [aroundWindow, windowRows, jumpLoadingId, scrollToRow, flashMessage, toast, t])

  return { flashMessageId, jumpLoadingId, onJumpToMessage, onScrollToIndexFailed }
}
