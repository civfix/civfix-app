import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { FEED_COUNTS_MAX_IDS } from "@civfix/shared"
import { useApi, useAuthState, useChatSocket } from "../context"
import { useFeedLiveStore } from "../feedLiveStore"
import { patchPostCountsInCaches } from "./posts"

export const FEED_COUNTS_DEBOUNCE_MS = 2000

export interface FeedCountsBatcher {
  note: (postId: string) => void
  dispose: () => void
}

export function createFeedCountsBatcher(
  fetchAndPatch: (postIds: string[]) => Promise<void>,
  debounceMs: number = FEED_COUNTS_DEBOUNCE_MS,
): FeedCountsBatcher {
  let pending = new Set<string>()
  let timer: ReturnType<typeof setTimeout> | null = null
  const flush = () => {
    timer = null
    const queued = [...pending]
    const postIds = queued.slice(0, FEED_COUNTS_MAX_IDS)
    pending = new Set(queued.slice(FEED_COUNTS_MAX_IDS))
    if (pending.size > 0) timer = setTimeout(flush, debounceMs)
    if (postIds.length > 0) void fetchAndPatch(postIds).catch(() => undefined)
  }
  return {
    note: (postId) => {
      pending.add(postId)
      timer ??= setTimeout(flush, debounceMs)
    },
    dispose: () => {
      if (timer != null) clearTimeout(timer)
      timer = null
      pending = new Set()
    },
  }
}

export function useFeedRealtime(): void {
  const api = useApi()
  const qc = useQueryClient()
  const socket = useChatSocket()
  const { isAuthenticated, user } = useAuthState()
  const viewerId = isAuthenticated ? (user?.id ?? null) : null

  useEffect(() => {
    useFeedLiveStore.getState().adoptViewer(viewerId)
  }, [viewerId])

  useEffect(() => {
    if (!isAuthenticated) return
    const batcher = createFeedCountsBatcher(async (postIds) => {
      const res = await api.getFeedCounts({ postIds })
      patchPostCountsInCaches(qc, res.items)
    })
    socket.retain()
    const unsubscribe = socket.subscribe((frame) => {
      if (frame.type !== "signal" || !frame.id) return
      if (frame.topic === "feed") useFeedLiveStore.getState().noteNewPost(frame.id)
      else if (frame.topic === "feed_counts") batcher.note(frame.id)
    })
    return () => {
      unsubscribe()
      socket.release()
      batcher.dispose()
    }
  }, [api, qc, socket, isAuthenticated])
}
