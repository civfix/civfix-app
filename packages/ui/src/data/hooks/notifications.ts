import { useRef } from "react"
import type { QueryClient } from "@tanstack/react-query"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  GetProfileResponse,
  NotificationDTO,
  NotificationPrefsDTO,
  UpdateNotificationPrefsRequest,
  UpdateSettingsRequest,
  UpdateSettingsResponse,
  UserDTO,
} from "@civfix/shared"
import { useApi, useAuthState, useOnUserUpdated } from "../context"
import { queryKeys } from "../keys"
import { optimisticPatch } from "../optimistic"

const NOTIFICATIONS_PREFIX = queryKeys.notificationsRoot

const INBOX_LIMIT = 50

export function useNotifications(limit = INBOX_LIMIT) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  const query = useQuery<NotificationDTO[]>({
    queryKey: queryKeys.notifications(limit),
    enabled: isAuthenticated,
    queryFn: async () => (await api.listNotifications({ limit })).items,
  })
  const unreadCount = (query.data ?? []).filter((n) => !n.read).length
  return { ...query, unreadCount }
}

export function useMarkNotificationsRead() {
  const api = useApi()
  const qc = useQueryClient()

  return useMutation<{ ok: true }, unknown, string[], MarkReadCtx>({
    mutationFn: async (ids) => {
      if (ids.length === 0) return { ok: true as const }
      return api.markNotificationsRead({ ids })
    },
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: NOTIFICATIONS_PREFIX })
      const previous = qc
        .getQueriesData<NotificationDTO[]>({ queryKey: NOTIFICATIONS_PREFIX })
        .filter(([, data]) => Array.isArray(data)) as Array<
        readonly [readonly unknown[], NotificationDTO[] | undefined]
      >
      patchReadInFlatLists(qc, ids)
      return { previous }
    },
    onError: (_err, _ids, ctx) => {
      for (const [key, data] of ctx?.previous ?? []) qc.setQueryData(key as unknown[], data)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: NOTIFICATIONS_PREFIX })
    },
  })
}

interface MarkReadCtx {
  previous?: Array<readonly [readonly unknown[], NotificationDTO[] | undefined]>
}

function patchReadInFlatLists(qc: QueryClient, ids: string[]): void {
  const idSet = new Set(ids)
  qc.setQueriesData<NotificationDTO[]>({ queryKey: NOTIFICATIONS_PREFIX }, (prev) =>
    Array.isArray(prev) ? prev.map((n) => (idSet.has(n.id) ? { ...n, read: true } : n)) : prev,
  )
}

export function useNotificationPrefs() {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useQuery<NotificationPrefsDTO>({
    queryKey: queryKeys.notificationPrefs,
    enabled: isAuthenticated,
    queryFn: () => api.getNotificationPrefs(),
    retry: false,
  })
}

export function useUpdateNotificationPrefs() {
  const api = useApi()
  const qc = useQueryClient()

  return useMutation(
    optimisticPatch<NotificationPrefsDTO, UpdateNotificationPrefsRequest, NotificationPrefsDTO>(qc, {
      key: queryKeys.notificationPrefs,
      mutationFn: (patch) => api.updateNotificationPrefs(patch),
      patch: (prev, patch) => ({ ...prev, ...patch }),
      reconcile: (_prev, server) => server,
    }),
  )
}

export type PrivacySettingsVars =
  | boolean
  | {
      allowDirectMessages?: boolean
      showVolunteerHours?: boolean
    }

interface PrivacySettingsCtx {
  previous?: Partial<Pick<UserDTO, "allowDirectMessages" | "showVolunteerHours">>
}

function privacySettingsPatch(next: PrivacySettingsVars): UpdateSettingsRequest {
  return typeof next === "boolean" ? { allowDirectMessages: next } : next
}

export function useUpdatePrivacySettings() {
  const api = useApi()
  const qc = useQueryClient()
  const onUserUpdated = useOnUserUpdated()
  const { user } = useAuthState()
  const userRef = useRef(user)
  userRef.current = user

  return useMutation<UpdateSettingsResponse, unknown, PrivacySettingsVars, PrivacySettingsCtx>({
    scope: { id: "me-settings" },
    mutationFn: (next) => api.updateSettings(privacySettingsPatch(next) satisfies UpdateSettingsRequest),
    onMutate: (next) => {
      const current = userRef.current
      if (!current || !onUserUpdated) return {}
      const patch = privacySettingsPatch(next)
      const previous: PrivacySettingsCtx["previous"] = {}
      if (patch.allowDirectMessages !== undefined) {
        previous.allowDirectMessages = current.allowDirectMessages
      }
      if (patch.showVolunteerHours !== undefined) {
        previous.showVolunteerHours = current.showVolunteerHours
      }
      onUserUpdated({ ...current, ...patch })
      return { previous }
    },
    onError: (_err, _next, ctx) => {
      const previous = ctx?.previous
      const current = userRef.current
      if (!previous || !current || !onUserUpdated) return
      onUserUpdated({ ...current, ...previous })
    },
    onSuccess: (res) => {
      onUserUpdated?.(res.user)
      qc.setQueryData<GetProfileResponse>(queryKeys.myProfile, (prev) =>
        prev
          ? { ...prev, profile: { ...prev.profile, showVolunteerHours: res.user.showVolunteerHours } }
          : prev,
      )
      void qc.invalidateQueries({ queryKey: queryKeys.myProfile })
      void qc.invalidateQueries({ queryKey: queryKeys.profile(res.user.id) })
      if (res.user.handle) void qc.invalidateQueries({ queryKey: queryKeys.profile(res.user.handle) })
      void qc.invalidateQueries({ queryKey: queryKeys.session })
    },
  })
}
