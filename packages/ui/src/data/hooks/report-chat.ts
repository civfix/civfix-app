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

export function useReportChatParticipants(id: string | undefined) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useQuery<ReportChatParticipantsResponse>({
    queryKey: queryKeys.reportChatParticipants(id ?? ""),
    enabled: isAuthenticated && !!id,
    queryFn: () => api.getReportChatParticipants({ id: id ?? "" }),
    retry: false,
    staleTime: 30_000,
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

export function useToggleMute(roomKind: RoomKind, roomId: string) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ muted }: { muted: boolean }) => api.toggleConversationMute({ roomKind, roomId, muted }),
    onSuccess: () => {
      for (const queryKey of muteInvalidationKeys(roomKind, roomId)) void qc.invalidateQueries({ queryKey })
    },
  })
}
interface HiddenThreadSlot {
  page: number
  index: number
  item: MessageThreadDTO
}

function threadMatchesRoom(
  thread: MessageThreadDTO,
  roomKind: RoomKind,
  roomId: string,
): boolean {
  return thread.kind === roomKind && (thread.refId ?? thread.id) === roomId
}

export function useHideConversation(roomKind: RoomKind, roomId: string) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<ToggleHiddenResponse, unknown, { hidden: boolean }, HiddenThreadSlot[]>({
    mutationFn: ({ hidden }) => api.toggleConversationHidden({ roomKind, roomId, hidden }),
    onMutate: async ({ hidden }) => {
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
    mutationFn: (vars: { roomKind: RoomKind; roomId: string }) => api.markThreadRead(vars),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.threads })
    },
  })
}
