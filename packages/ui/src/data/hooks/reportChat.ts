import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { InfiniteData } from "@tanstack/react-query"
import type {
  ListThreadsResponse,
  MessageThreadDTO,
  ReportChatParticipantsResponse,
  RoomKind,
  ToggleHiddenResponse,
} from "@civfix/shared"
import { useApi, useAuthState } from "../context"
import { queryKeys } from "../keys"
import { threadMatchesRoom } from "../threadRoom"

const CHAT_PARTICIPANTS_STALE_MS = 30_000

export function useReportChatParticipants(id: string | undefined) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useQuery<ReportChatParticipantsResponse>({
    queryKey: queryKeys.reportChatParticipants(id ?? ""),
    enabled: isAuthenticated && !!id,
    queryFn: () => api.getReportChatParticipants({ id: id ?? "" }),
    retry: false,
    staleTime: CHAT_PARTICIPANTS_STALE_MS,
  })
}

export function useJoinReportChat() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (reportId: string) => api.joinReportChat({ id: reportId }),
    onSuccess: (_data, reportId) => {
      void qc.invalidateQueries({ queryKey: queryKeys.report(reportId) })
      void qc.invalidateQueries({ queryKey: queryKeys.threads })
    },
  })
}

export function useLeaveReportChat() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (reportId: string) => api.leaveReportChat({ id: reportId }),
    onSuccess: (_data, reportId) => {
      void qc.invalidateQueries({ queryKey: queryKeys.report(reportId) })
      void qc.invalidateQueries({ queryKey: queryKeys.threads })
    },
  })
}

export function muteInvalidationKeys(roomKind: RoomKind, roomId: string): readonly (readonly unknown[])[] {
  return roomKind === "group" ? [queryKeys.threads, queryKeys.groupInfo(roomId)] : [queryKeys.threads]
}

export interface ThreadRoomVars {
  roomKind: RoomKind
  roomId: string
}

// The room rides in the variables so one observer can serve every inbox row.
export function useToggleMute() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ roomKind, roomId, muted }: ThreadRoomVars & { muted: boolean }) =>
      api.toggleConversationMute({ roomKind, roomId, muted }),
    onSuccess: (_res, { roomKind, roomId }) => {
      for (const queryKey of muteInvalidationKeys(roomKind, roomId)) void qc.invalidateQueries({ queryKey })
    },
  })
}
interface HiddenThreadSlot {
  page: number
  index: number
  item: MessageThreadDTO
}

export function useHideConversation() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<ToggleHiddenResponse, unknown, ThreadRoomVars & { hidden: boolean }, HiddenThreadSlot[]>({
    mutationFn: ({ roomKind, roomId, hidden }) => api.toggleConversationHidden({ roomKind, roomId, hidden }),
    onMutate: async ({ roomKind, roomId, hidden }) => {
      if (!hidden) return []
      await qc.cancelQueries({ queryKey: queryKeys.threads })
      const data = qc.getQueryData<InfiniteData<ListThreadsResponse>>(queryKeys.threads)
      if (data === undefined) return []
      const removed: HiddenThreadSlot[] = []
      const pages = data.pages.map((page, pageIndex) => {
        const items = (page.items ?? []).filter((item, index) => {
          if (item == null || !threadMatchesRoom(item, roomKind, roomId)) return true
          removed.push({ page: pageIndex, index, item })
          return false
        })
        return { ...page, items }
      })
      if (removed.length === 0) return []
      qc.setQueryData<InfiniteData<ListThreadsResponse>>(queryKeys.threads, { ...data, pages })
      return removed
    },
    onError: (_err, _vars, removed) => {
      if (removed === undefined || removed.length === 0) return
      const data = qc.getQueryData<InfiniteData<ListThreadsResponse>>(queryKeys.threads)
      if (data === undefined) return
      const pages = data.pages.map((page, pageIndex) => {
        const restore = removed.filter((slot) => slot.page === pageIndex)
        if (restore.length === 0) return page
        const items = [...(page.items ?? [])]
        for (const slot of restore) items.splice(Math.min(slot.index, items.length), 0, slot.item)
        return { ...page, items }
      })
      qc.setQueryData<InfiniteData<ListThreadsResponse>>(queryKeys.threads, { ...data, pages })
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.threads })
    },
  })
}

export function useMarkThreadRead() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: ThreadRoomVars) => api.markThreadRead(vars),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.threads })
    },
  })
}
