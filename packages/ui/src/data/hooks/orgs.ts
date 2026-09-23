import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query"
import type {
  AcceptMyOrgInviteResponse,
  UpdateOrganizationRequest,
  CleanupDTO,
  DeclineMyOrgInviteResponse,
  InviteOrganizationMemberResponse,
  ListOrganizationEventsResponse,
  ListOrganizationMembersResponse,
  OrgInviteIdentifierKind,
  OrganizationDTO,
  OrganizationInviteDTO,
  OrganizationInviteRole,
  OrganizationMemberDTO,
  PendingOrganizationInviteDTO,
  RemoveOrganizationMemberResponse,
  RevokeOrganizationInviteResponse,
  SetOrganizationMemberRoleResponse,
} from "@civfix/shared"
import { useApi, useAuthState } from "../context"
import { queryKeys } from "../keys"
import { listItems } from "../types"

export function useOrganization(slug: string | undefined) {
  const api = useApi()
  return useQuery<OrganizationDTO>({
    queryKey: queryKeys.org(slug ?? "unknown"),
    enabled: !!slug,
    queryFn: () => api.getOrganization({ slug: slug as string }),
    retry: false,
  })
}

export function useMyOrganizations() {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useQuery<OrganizationDTO[]>({
    queryKey: queryKeys.myOrganizations,
    enabled: isAuthenticated,
    queryFn: async () => listItems((await api.listMyOrganizations({}))?.items),
    retry: false,
  })
}

/**
 * The organizations a viewer can currently ACT AS. A suspended org refuses every write the pickers
 * lead to (DECISIONS §32), so offering it only produces a refusal the reader cannot act on.
 *
 * `undefined` in, `undefined` out: that is `authorAsSelection`'s "the membership list has not loaded"
 * sentinel, and collapsing it to an empty array reads as "you left every org" and wipes the stored
 * selection on every cold mount.
 */
export function actableOrganizations(
  orgs: readonly OrganizationDTO[] | undefined,
): OrganizationDTO[] | undefined {
  return orgs?.filter((org) => org.suspended !== true)
}

export function useUpdateOrganization(slug: string | undefined) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<OrganizationDTO, unknown, UpdateOrganizationRequest>({
    mutationFn: (vars) => api.updateOrganization(vars),
    onSuccess: (org) => {
      qc.setQueryData(queryKeys.org(org.slug), org)
      if (slug && slug !== org.slug) void qc.invalidateQueries({ queryKey: queryKeys.org(slug) })
      void qc.invalidateQueries({ queryKey: queryKeys.myOrganizations })
    },
  })
}

export type OrganizationEventsWindow = "upcoming" | "past"

export const ORG_EVENTS_PAGE_SIZE = 3

export function useOrganizationEvents(
  slug: string | undefined,
  when: OrganizationEventsWindow = "upcoming",
  opts: { enabled?: boolean } = {},
) {
  const api = useApi()
  return useInfiniteQuery<ListOrganizationEventsResponse>({
    queryKey: queryKeys.orgEvents(slug ?? "unknown", when),
    enabled: !!slug && (opts.enabled ?? true),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.listOrganizationEvents({
        slug: slug as string,
        when,
        limit: ORG_EVENTS_PAGE_SIZE,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (lastPage: ListOrganizationEventsResponse) => lastPage.nextCursor ?? undefined,
    retry: false,
  })
}

let warnedUnrenderableOrgEvents = false

export function resetOrganizationEventRowWarnings(): void {
  warnedUnrenderableOrgEvents = false
}

export function organizationEventRows(
  pages: readonly ListOrganizationEventsResponse[] | undefined,
): CleanupDTO[] {
  const items = (pages ?? []).flatMap((page) => page?.items ?? [])
  const rows = items.filter((event) => event != null && event.id != null && event.organizer != null)
  if (rows.length < items.length && !warnedUnrenderableOrgEvents) {
    warnedUnrenderableOrgEvents = true
    console.warn(
      `[@civfix/ui] listOrganizationEvents returned ${items.length - rows.length} row(s) the event card cannot render; dropping them.`,
    )
  }
  return rows
}

export const ORG_MEMBERS_PAGE_SIZE = 50

export function useOrganizationMembers(orgId: string | undefined, opts: { enabled?: boolean } = {}) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useInfiniteQuery<ListOrganizationMembersResponse>({
    queryKey: queryKeys.orgMembers(orgId ?? "unknown"),
    enabled: !!orgId && isAuthenticated && (opts.enabled ?? true),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.listOrganizationMembers({
        id: orgId as string,
        limit: ORG_MEMBERS_PAGE_SIZE,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (lastPage: ListOrganizationMembersResponse) => lastPage.nextCursor ?? undefined,
    retry: false,
  })
}

export function organizationMemberRows(
  pages: readonly ListOrganizationMembersResponse[] | undefined,
): OrganizationMemberDTO[] {
  return (pages ?? []).flatMap((page) => page.items)
}

export function useOrganizationInvites(orgId: string | undefined, opts: { enabled?: boolean } = {}) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useQuery<OrganizationInviteDTO[]>({
    queryKey: queryKeys.orgInvites(orgId ?? "unknown"),
    enabled: !!orgId && isAuthenticated && (opts.enabled ?? true),
    queryFn: async () => listItems((await api.listOrganizationInvites({ id: orgId as string }))?.items),
    retry: false,
  })
}

function invalidateOrgTeam(qc: QueryClient, orgId: string): void {
  void qc.invalidateQueries({ queryKey: queryKeys.orgMembers(orgId) })
  void qc.invalidateQueries({ queryKey: queryKeys.orgInvites(orgId) })
}

export interface InviteOrganizationMemberVars {
  identifierKind: OrgInviteIdentifierKind
  identifier: string
  role: OrganizationInviteRole
}

export function useInviteOrganizationMember(orgId: string | undefined) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<InviteOrganizationMemberResponse, unknown, InviteOrganizationMemberVars>({
    mutationFn: (vars) => api.inviteOrganizationMember({ id: orgId as string, ...vars }),
    onSuccess: () => {
      if (orgId) invalidateOrgTeam(qc, orgId)
    },
  })
}

export function useRevokeOrganizationInvite(orgId: string | undefined) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<RevokeOrganizationInviteResponse, unknown, { inviteId: string }>({
    mutationFn: ({ inviteId }) => api.revokeOrganizationInvite({ id: orgId as string, inviteId }),
    onSuccess: () => {
      if (orgId) invalidateOrgTeam(qc, orgId)
    },
  })
}

export interface SetOrganizationMemberRoleVars {
  userId: string
  role: OrganizationInviteRole
}

export function useSetOrganizationMemberRole(orgId: string | undefined) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<SetOrganizationMemberRoleResponse, unknown, SetOrganizationMemberRoleVars>({
    mutationFn: ({ userId, role }) =>
      api.setOrganizationMemberRole({ id: orgId as string, userId, role }),
    onSuccess: () => {
      if (orgId) invalidateOrgTeam(qc, orgId)
    },
  })
}

export function useRemoveOrganizationMember(orgId: string | undefined) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<RemoveOrganizationMemberResponse, unknown, { userId: string }>({
    mutationFn: ({ userId }) => api.removeOrganizationMember({ id: orgId as string, userId }),
    onSuccess: () => {
      if (orgId) invalidateOrgTeam(qc, orgId)
      void qc.invalidateQueries({ queryKey: queryKeys.myOrganizations })
    },
  })
}

export function invalidateMyOrgInvites(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: queryKeys.myOrgInvites })
  void qc.invalidateQueries({ queryKey: queryKeys.myOrganizations })
  void qc.invalidateQueries({ queryKey: queryKeys.notificationsRoot })
}

export function useMyOrgInvites(opts: { enabled?: boolean } = {}) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useQuery<PendingOrganizationInviteDTO[]>({
    queryKey: queryKeys.myOrgInvites,
    enabled: isAuthenticated && (opts.enabled ?? true),
    queryFn: async () => listItems((await api.listMyOrgInvites({}))?.items),
    retry: false,
  })
}

export function useAcceptMyOrgInvite() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<AcceptMyOrgInviteResponse, unknown, { inviteId: string }>({
    mutationFn: ({ inviteId }) => api.acceptMyOrgInvite({ inviteId }),
    onSuccess: (res) => {
      invalidateMyOrgInvites(qc)
      void qc.invalidateQueries({ queryKey: queryKeys.org(res.organization.slug) })
    },
  })
}

export function useDeclineMyOrgInvite() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<DeclineMyOrgInviteResponse, unknown, { inviteId: string }>({
    mutationFn: ({ inviteId }) => api.declineMyOrgInvite({ inviteId }),
    onSuccess: () => invalidateMyOrgInvites(qc),
  })
}
