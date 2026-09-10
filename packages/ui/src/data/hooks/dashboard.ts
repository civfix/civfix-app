import type { QueryClient } from "@tanstack/react-query"
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  AcceptMyOrgInviteResponse,
  CreateOrgPayoutResponse,
  CreateOrgStripeAccountLinkResponse,
  DeclineMyOrgInviteResponse,
  CleanupDTO,
  DuplicateCleanupRequest,
  HostedEventsAnalyticsResponse,
  InviteOrganizationMemberResponse,
  ListOrgPayoutsResponse,
  ListOrganizationMembersResponse,
  OrgBalanceDTO,
  OrgDonationSummaryDTO,
  OrgInviteIdentifierKind,
  OrgPaymentsStatusDTO,
  OrganizationInviteDTO,
  OrganizationMemberDTO,
  PayoutDTO,
  PendingOrganizationInviteDTO,
  PortfolioAnalyticsRange,
  RemoveOrganizationMemberResponse,
  RevokeOrganizationInviteResponse,
  SetOrganizationMemberRoleResponse,
} from "@civfix/shared"
import { useApi, useAuthState } from "../context"
import { queryKeys } from "../keys"

export const ORG_MEMBERS_PAGE_SIZE = 50

export const ORG_PAYOUTS_PAGE_SIZE = 10

export function useHostedEventsAnalytics(
  range: PortfolioAnalyticsRange = "30d",
  orgId: string | null = null,
) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useQuery<HostedEventsAnalyticsResponse>({
    queryKey: queryKeys.hostedEventsAnalytics(range, orgId),
    enabled: isAuthenticated,
    queryFn: () => api.hostedEventsAnalytics({ range, ...(orgId ? { orgId } : {}) }),
    retry: false,
  })
}

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

export function orgMemberRows(
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
    queryFn: async () => (await api.listOrganizationInvites({ id: orgId as string })).items,
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
  role: "admin" | "member"
}

export function useInviteOrganizationMember(orgId: string) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<InviteOrganizationMemberResponse, unknown, InviteOrganizationMemberVars>({
    mutationFn: (vars) => api.inviteOrganizationMember({ ...vars, id: orgId }),
    onSuccess: () => invalidateOrgTeam(qc, orgId),
  })
}

export function useRevokeOrganizationInvite(orgId: string) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<RevokeOrganizationInviteResponse, unknown, { inviteId: string }>({
    mutationFn: ({ inviteId }) => api.revokeOrganizationInvite({ id: orgId, inviteId }),
    onSuccess: () => invalidateOrgTeam(qc, orgId),
  })
}

export function useSetOrganizationMemberRole(orgId: string) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<
    SetOrganizationMemberRoleResponse,
    unknown,
    { userId: string; role: "admin" | "member" }
  >({
    mutationFn: ({ userId, role }) => api.setOrganizationMemberRole({ id: orgId, userId, role }),
    onSuccess: () => invalidateOrgTeam(qc, orgId),
  })
}

export function useRemoveOrganizationMember(orgId: string) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<RemoveOrganizationMemberResponse, unknown, { userId: string }>({
    mutationFn: ({ userId }) => api.removeOrganizationMember({ id: orgId, userId }),
    onSuccess: () => invalidateOrgTeam(qc, orgId),
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
    queryFn: async () => (await api.listMyOrgInvites({})).items,
    retry: false,
  })
}

export function useAcceptMyOrgInvite() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<AcceptMyOrgInviteResponse, unknown, { inviteId: string }>({
    mutationFn: ({ inviteId }) => api.acceptMyOrgInvite({ inviteId }),
    onSuccess: () => invalidateMyOrgInvites(qc),
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

export function useOrgPaymentsStatus(orgId: string | undefined, opts: { enabled?: boolean } = {}) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useQuery<OrgPaymentsStatusDTO>({
    queryKey: queryKeys.orgPayments(orgId ?? "unknown"),
    enabled: !!orgId && isAuthenticated && (opts.enabled ?? true),
    queryFn: () => api.getOrgPaymentsStatus({ id: orgId as string }),
    retry: false,
  })
}

export interface OrgDonationSummaryRange {
  from?: string
  to?: string
}

export function useOrgDonationSummary(
  orgId: string | undefined,
  range: OrgDonationSummaryRange = {},
  opts: { enabled?: boolean } = {},
) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  const from = range.from ?? null
  const to = range.to ?? null
  return useQuery<OrgDonationSummaryDTO>({
    queryKey: queryKeys.orgDonationSummary(orgId ?? "unknown", from, to),
    enabled: !!orgId && isAuthenticated && (opts.enabled ?? true),
    queryFn: () =>
      api.getOrgDonationSummary({
        id: orgId as string,
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      }),
    retry: false,
  })
}

export function useOrgBalance(orgId: string | undefined, opts: { enabled?: boolean } = {}) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useQuery<OrgBalanceDTO>({
    queryKey: queryKeys.orgBalance(orgId ?? "unknown"),
    enabled: !!orgId && isAuthenticated && (opts.enabled ?? true),
    queryFn: () => api.getOrgBalance({ id: orgId as string }),
    retry: false,
  })
}

export interface CreateOrgPayoutVars {
  idempotencyKey: string
  amountMinor?: number
}

export function useCreateOrgPayout(orgId: string) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<CreateOrgPayoutResponse, unknown, CreateOrgPayoutVars>({
    mutationFn: ({ idempotencyKey, amountMinor }) =>
      api.createOrgPayout({
        id: orgId,
        currency: "USD",
        idempotencyKey,
        ...(typeof amountMinor === "number" ? { amountMinor } : {}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.orgBalance(orgId) })
      void qc.invalidateQueries({ queryKey: queryKeys.orgPayouts(orgId) })
    },
  })
}

export function useOrgPayouts(orgId: string | undefined, opts: { enabled?: boolean } = {}) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useInfiniteQuery<ListOrgPayoutsResponse>({
    queryKey: queryKeys.orgPayouts(orgId ?? "unknown"),
    enabled: !!orgId && isAuthenticated && (opts.enabled ?? true),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.listOrgPayouts({
        id: orgId as string,
        limit: ORG_PAYOUTS_PAGE_SIZE,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (lastPage: ListOrgPayoutsResponse) => lastPage.nextCursor ?? undefined,
    retry: false,
  })
}

export function payoutRows(pages: readonly ListOrgPayoutsResponse[] | undefined): PayoutDTO[] {
  return (pages ?? []).flatMap((page) => page.items)
}

export function useCreateOrgStripeAccountLink(orgId: string) {
  const api = useApi()
  return useMutation<
    CreateOrgStripeAccountLinkResponse,
    unknown,
    { type: "onboarding" | "update" }
  >({
    mutationFn: ({ type }) => api.createOrgStripeAccountLink({ id: orgId, type }),
    gcTime: 0,
  })
}

export function useDuplicateCleanup() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<CleanupDTO, unknown, DuplicateCleanupRequest>({
    mutationFn: (input) => api.duplicateCleanup(input),
    onSuccess: (cleanup) => {
      qc.setQueryData<CleanupDTO>(queryKeys.cleanup(cleanup.id), cleanup)
      void qc.invalidateQueries({ queryKey: queryKeys.hostedEventsRoot })
      void qc.invalidateQueries({ queryKey: ["cleanups"] })
    },
  })
}
