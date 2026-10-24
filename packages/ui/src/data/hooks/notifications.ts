import { useLayoutEffect, useMemo, useRef } from "react"
import type { Query, QueryClient } from "@tanstack/react-query"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  GetProfileResponse,
  NotificationCategory,
  NotificationCategorySetting,
  NotificationDTO,
  NotificationSettingsDTO,
  UpdateSettingsRequest,
  UpdateSettingsResponse,
  UserDTO,
} from "@civfix/contract"
import { useApi, useAuthState, useOnUserUpdated } from "../context"
import { queryKeys } from "../keys"
import { listItems } from "../types"

// `notificationSettings` shares the `notifications` root, so a bare prefix would also cancel and refetch it.
export const notificationListFilters = {
  queryKey: queryKeys.notificationsRoot,
  predicate: (query: Query) => typeof query.queryKey[1] === "number",
}

const INBOX_LIMIT = 50

export function useNotifications(limit = INBOX_LIMIT) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  const query = useQuery<NotificationDTO[]>({
    queryKey: queryKeys.notifications(limit),
    enabled: isAuthenticated,
    queryFn: async () => listItems((await api.listNotifications({ limit }))?.items),
  })
  const { data, isLoading, isError } = query
  const unreadCount = useMemo(() => (data ?? []).filter((n) => !n.read).length, [data])
  // Picking fields keeps TanStack's tracked-property subscription; a spread reads every getter, so the
  // always-mounted map controls re-rendered on each background fetch start and settle.
  return { data, isLoading, isError, unreadCount }
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
      await qc.cancelQueries(notificationListFilters)
      const previous = qc
        .getQueriesData<NotificationDTO[]>(notificationListFilters)
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
      void qc.invalidateQueries(notificationListFilters)
    },
  })
}

interface MarkReadCtx {
  previous?: Array<readonly [readonly unknown[], NotificationDTO[] | undefined]>
}

function patchReadInFlatLists(qc: QueryClient, ids: string[]): void {
  const idSet = new Set(ids)
  qc.setQueriesData<NotificationDTO[]>(notificationListFilters, (prev) =>
    Array.isArray(prev) ? prev.map((n) => (idSet.has(n.id) ? { ...n, read: true } : n)) : prev,
  )
}

export function useNotificationSettings() {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useQuery<NotificationSettingsDTO>({
    queryKey: queryKeys.notificationSettings,
    enabled: isAuthenticated,
    queryFn: () => api.getNotificationSettings(),
    retry: false,
  })
}

export interface NotificationSettingChange {
  category: NotificationCategory
  change: Partial<NotificationCategorySetting>
}

interface NotificationSettingRollback {
  previous?: Partial<NotificationCategorySetting>
}

function withCategoryChange(
  settings: NotificationSettingsDTO,
  { category, change }: NotificationSettingChange,
): NotificationSettingsDTO {
  return {
    ...settings,
    categories: { ...settings.categories, [category]: { ...settings.categories[category], ...change } },
  }
}

// Each press saves at once, so several saves can overlap. A failed one restores only the fields it changed,
// keeping a newer press's optimistic value, and the server's answer replaces the cache only once no other
// save is in flight: an earlier answer predates the newer presses.
export function useUpdateNotificationSettings() {
  const api = useApi()
  const qc = useQueryClient()
  const key = queryKeys.notificationSettings

  return useMutation<NotificationSettingsDTO, unknown, NotificationSettingChange, NotificationSettingRollback>({
    mutationKey: key,
    mutationFn: ({ category, change }) => api.updateNotificationSettings({ categories: { [category]: change } }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: key })
      const current = qc.getQueryData<NotificationSettingsDTO>(key)
      if (!current) return {}
      const before = current.categories[vars.category]
      const previous = Object.fromEntries(
        Object.keys(vars.change).map((field) => [field, before[field as keyof NotificationCategorySetting]]),
      ) as Partial<NotificationCategorySetting>
      qc.setQueryData<NotificationSettingsDTO>(key, withCategoryChange(current, vars))
      return { previous }
    },
    onError: (_err, { category }, ctx) => {
      const previous = ctx?.previous
      if (!previous) return
      qc.setQueryData<NotificationSettingsDTO>(key, (current) =>
        current ? withCategoryChange(current, { category, change: previous }) : current,
      )
    },
    onSuccess: (server) => {
      if (qc.isMutating({ mutationKey: key }) === 1) qc.setQueryData<NotificationSettingsDTO>(key, server)
    },
  })
}

export type PrivacySettingsVars =
  | boolean
  | {
      allowDirectMessages?: boolean
      showVolunteerHours?: boolean
      primaryOrganizationId?: string | null
    }

interface PrivacySettingsCtx {
  previous?: Partial<
    Pick<UserDTO, "allowDirectMessages" | "showVolunteerHours" | "primaryOrganizationId">
  >
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
  useLayoutEffect(() => {
    userRef.current = user
  }, [user])

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
      if (patch.primaryOrganizationId !== undefined) {
        previous.primaryOrganizationId = current.primaryOrganizationId ?? null
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
    onSuccess: (res, next) => {
      onUserUpdated?.(res.user)
      qc.setQueryData<GetProfileResponse>(queryKeys.myProfile, (prev) =>
        prev
          ? { ...prev, profile: { ...prev.profile, showVolunteerHours: res.user.showVolunteerHours } }
          : prev,
      )
      void qc.invalidateQueries({ queryKey: queryKeys.myProfile })
      void qc.invalidateQueries({ queryKey: queryKeys.profile(res.user.id) })
      if (res.user.handle) void qc.invalidateQueries({ queryKey: queryKeys.profile(res.user.handle) })
      if (privacySettingsPatch(next).primaryOrganizationId !== undefined) {
        void qc.invalidateQueries({ queryKey: queryKeys.postsRoot })
        void qc.invalidateQueries({ queryKey: queryKeys.postRoot })
      }
      void qc.invalidateQueries({ queryKey: queryKeys.session })
    },
  })
}
