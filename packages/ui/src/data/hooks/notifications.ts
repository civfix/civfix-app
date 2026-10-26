import { useLayoutEffect, useRef } from "react"
import type { Query, QueryClient } from "@tanstack/react-query"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  GetProfileResponse,
  NotificationCategory,
  NotificationCategorySetting,
  NotificationDTO,
  NotificationSettingsDTO,
  NotificationUnreadResponse,
  UpdateSettingsRequest,
  UpdateSettingsResponse,
  UserDTO,
} from "@civfix/contract"
import { useApi, useAuthState, useOnUserUpdated } from "../context"
import { queryKeys } from "../keys"
import { listItems } from "../types"

// `notificationSettings` and `notificationsUnread` share the `notifications` root, so a bare prefix would also
// cancel and refetch them.
export const notificationListFilters = {
  queryKey: queryKeys.notificationsRoot,
  predicate: (query: Query) => typeof query.queryKey[1] === "number",
}

/** The notifications page's first page; web push's focus reconcile reads the same page. */
export const INBOX_LIMIT = 50

export function useNotifications(limit = INBOX_LIMIT) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  const query = useQuery<NotificationDTO[]>({
    queryKey: queryKeys.notifications(limit),
    enabled: isAuthenticated,
    queryFn: async () => listItems((await api.listNotifications({ limit }))?.items),
  })
  const { data, isLoading, isError, isFetching } = query
  // Picking fields keeps TanStack's tracked-property subscription; a spread reads every getter, so a
  // consumer would re-render on every query state change it never reads.
  return { data, isLoading, isError, isFetching }
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
      const previous = snapshotFlatLists(qc)
      const idSet = new Set(ids)
      patchReadInFlatLists(qc, (n) => idSet.has(n.id))
      return { previous }
    },
    onError: (_err, _ids, ctx) => {
      for (const [key, data] of ctx?.previous ?? []) qc.setQueryData(key as unknown[], data)
    },
    onSettled: () => {
      void qc.invalidateQueries(notificationListFilters)
      void qc.invalidateQueries({ queryKey: queryKeys.notificationsUnread })
    },
  })
}

interface MarkReadCtx {
  previous?: Array<readonly [readonly unknown[], NotificationDTO[] | undefined]>
}

interface MarkAllReadCtx extends MarkReadCtx {
  unread?: NotificationUnreadResponse
}

function snapshotFlatLists(qc: QueryClient): NonNullable<MarkReadCtx["previous"]> {
  return qc
    .getQueriesData<NotificationDTO[]>(notificationListFilters)
    .filter(([, data]) => Array.isArray(data)) as Array<readonly [readonly unknown[], NotificationDTO[] | undefined]>
}

function patchReadInFlatLists(qc: QueryClient, marked: (n: NotificationDTO) => boolean): void {
  qc.setQueriesData<NotificationDTO[]>(notificationListFilters, (prev) =>
    Array.isArray(prev) ? prev.map((n) => (marked(n) ? { ...n, read: true } : n)) : prev,
  )
}

// The dots read the server's answer, not the first page of the list: an unread row past it still counts.
export function useHasUnreadNotifications(): boolean {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  const query = useQuery<NotificationUnreadResponse>({
    queryKey: queryKeys.notificationsUnread,
    enabled: isAuthenticated,
    queryFn: () => api.getNotificationUnread(),
  })
  return isAuthenticated && query.data?.hasUnread === true
}

// The server marks every notification the page lists, past the first page too, so the dot clears with it.
export function useMarkAllNotificationsRead() {
  const api = useApi()
  const qc = useQueryClient()

  return useMutation<{ ok: true }, unknown, void, MarkAllReadCtx>({
    mutationFn: () => api.markAllNotificationsRead(),
    onMutate: async () => {
      await Promise.all([
        qc.cancelQueries(notificationListFilters),
        qc.cancelQueries({ queryKey: queryKeys.notificationsUnread }),
      ])
      const previous = snapshotFlatLists(qc)
      const unread = qc.getQueryData<NotificationUnreadResponse>(queryKeys.notificationsUnread)
      patchReadInFlatLists(qc, () => true)
      qc.setQueryData<NotificationUnreadResponse>(queryKeys.notificationsUnread, { hasUnread: false })
      return { previous, unread }
    },
    onError: (_err, _vars, ctx) => {
      for (const [key, data] of ctx?.previous ?? []) qc.setQueryData(key as unknown[], data)
      if (ctx?.unread) qc.setQueryData(queryKeys.notificationsUnread, ctx.unread)
    },
    onSettled: () => {
      void qc.invalidateQueries(notificationListFilters)
      void qc.invalidateQueries({ queryKey: queryKeys.notificationsUnread })
    },
  })
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
