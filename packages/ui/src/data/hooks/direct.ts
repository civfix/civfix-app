import { useCallback } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  BlockUserResponse,
  ListBlocksResponse,
  OpenDmResponse,
  SearchUsersResponse,
  MessageThreadDTO,
} from "@civfix/shared"
import { useApi } from "../context"
import { useAuthState, useRequireAuth } from "../context"
import { queryKeys } from "../keys"
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "./useDebouncedValue"

export function normalizeUserSearchTerm(rawQuery: string): string {
  return rawQuery.trim().replace(/^@+/, "")
}

export function useUserSearch(rawQuery: string) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  const q = useDebouncedValue(rawQuery, SEARCH_DEBOUNCE_MS)
  const trimmed = normalizeUserSearchTerm(q)
  const query = useQuery<SearchUsersResponse, unknown, SearchUsersResponse>({
    queryKey: queryKeys.userSearch(trimmed),
    enabled: isAuthenticated && trimmed.length > 0,
    queryFn: () => api.searchUsers({ q: trimmed, limit: 20 }),
    retry: false,
    staleTime: 30_000,
  })
  return { ...query, term: trimmed }
}

export function useOpenDm() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<OpenDmResponse, unknown, string>({
    mutationFn: (userId: string) => api.openDm({ userId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.threads })
    },
  })
}

export interface DmTarget {
  id: string
  name?: string | null
  handle?: string | null
}

export interface ResolvedDm {
  roomId: string
  thread: MessageThreadDTO
  target: DmTarget
}

export interface StartDmHandlers {
  onResolved: (resolved: ResolvedDm) => void
  onError?: (err: unknown) => void
}

export function useStartDm() {
  const requireAuth = useRequireAuth()
  const openDm = useOpenDm()

  const start = useCallback(
    (target: DmTarget, resumePath: string, handlers: StartDmHandlers) => {
      requireAuth(
        () => {
          openDm.mutate(target.id, {
            onSuccess: (res) => {
              const thread = res.thread
              const roomId = thread.refId ?? thread.id
              handlers.onResolved({ roomId, thread, target })
            },
            onError: (err) => handlers.onError?.(err),
          })
        },
        { next: resumePath },
      )
    },
    [requireAuth, openDm],
  )

  return { start, isPending: openDm.isPending }
}

export function useBlockUser() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<BlockUserResponse, unknown, string>({
    mutationFn: (id: string) => api.blockUser({ id }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.threads })
      void qc.invalidateQueries({ queryKey: queryKeys.blocks })
      void qc.invalidateQueries({ queryKey: queryKeys.profileRoot })
    },
  })
}

export function useListBlocks() {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useQuery<ListBlocksResponse, unknown, ListBlocksResponse>({
    queryKey: queryKeys.blocks,
    enabled: isAuthenticated,
    queryFn: () => api.listBlocks({}),
    retry: false,
  })
}

export function useUnblockUser() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<BlockUserResponse, unknown, string>({
    mutationFn: (id: string) => api.unblockUser({ id }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.blocks })
      void qc.invalidateQueries({ queryKey: queryKeys.threads })
      void qc.invalidateQueries({ queryKey: queryKeys.profileRoot })
    },
  })
}
