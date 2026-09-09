import type { Query, QueryClient, QueryFilters, UseMutationOptions } from "@tanstack/react-query"
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  CleanupDTO,
  CleanupAttendeesResponse,
  CreateCleanupRequest,
  UpdateCleanupRequest,
  JoinCleanupResponse,
  RequestEventResourcesResponse,
  SetMemberRoleResponse,
  RemoveMemberResponse,
  GuestRsvpRequestRequest,
  GuestRsvpRequestResponse,
  GuestRsvpVerifyRequest,
  GuestRsvpVerifyResponse,
  GuestRsvpCancelRequest,
  GuestRsvpCancelResponse,
  GetCleanupGuestsResponse,
} from "@civfix/shared"
import { useToast } from "../../primitives/toastContext"
import { useT } from "../../i18n/useT"
import { appErrorCode } from "../../bodies/errorCode"
import { useApi, useAuthState } from "../context"
import { queryKeys } from "../keys"

const CLEANUPS_LIST_PREFIX = ["cleanups"] as const

export function cleanupDetailFilters(id: string): QueryFilters {
  return {
    predicate: (query: Query) => {
      const key = query.queryKey
      if (key[0] !== "cleanup" || key.length !== 2) return false
      if (key[1] === id) return true
      const data = query.state.data as { id?: unknown } | undefined
      return typeof data === "object" && data !== null && data.id === id
    },
  }
}

function getCachedCleanupDetail(qc: QueryClient, id: string): CleanupDTO | undefined {
  for (const [, data] of qc.getQueriesData<CleanupDTO>(cleanupDetailFilters(id))) {
    if (data) return data
  }
  return undefined
}

function patchCleanupDetails(
  qc: QueryClient,
  id: string,
  update: (prev: CleanupDTO) => CleanupDTO,
): void {
  qc.setQueriesData<CleanupDTO>(cleanupDetailFilters(id), (prev) => (prev ? update(prev) : prev))
}

function reconcileCleanupDetails(qc: QueryClient, id: string, res: CleanupDTO): void {
  qc.setQueriesData<CleanupDTO>(cleanupDetailFilters(id), () => res)
}

type When = "upcoming" | "past"

export function useCleanups(when: When, limit = 50) {
  const api = useApi()
  return useQuery<CleanupDTO[]>({
    queryKey: queryKeys.cleanups(when, limit),
    queryFn: async () => (await api.listCleanups({ when, limit })).items,
  })
}

export function useAttendingCleanups(limit = 20) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useQuery<CleanupDTO[]>({
    queryKey: queryKeys.cleanups("attending", limit),
    enabled: isAuthenticated,
    queryFn: async () =>
      ((await api.listCleanups({ when: "attending", limit })).items ?? []).filter(
        (c): c is CleanupDTO => c != null,
      ),
  })
}

export function useCleanup(id: string | undefined) {
  const api = useApi()
  return useQuery<CleanupDTO>({
    queryKey: queryKeys.cleanup(id ?? "unknown"),
    enabled: !!id,
    queryFn: () => api.getCleanup({ id: id as string }),
    retry: false,
  })
}

export function useCleanupAttendees(id: string | undefined) {
  const api = useApi()
  return useQuery<CleanupAttendeesResponse>({
    queryKey: queryKeys.cleanupAttendees(id ?? "unknown"),
    enabled: !!id,
    queryFn: () => api.getCleanupAttendees({ id: id as string }),
    retry: false,
  })
}

export interface JoinCleanupCtx {
  prevDetails: ReadonlyArray<readonly [readonly unknown[], CleanupDTO | undefined]>
  prevLists: ReadonlyArray<readonly [readonly unknown[], CleanupDTO[] | undefined]>
  prevAttendees: CleanupAttendeesResponse | undefined
}

function patchCleanupInFlatLists(
  qc: QueryClient,
  id: string,
  next: { joined: boolean; going: number },
): void {
  qc.setQueriesData<CleanupDTO[]>({ queryKey: CLEANUPS_LIST_PREFIX }, (prev) =>
    Array.isArray(prev)
      ? prev.map((c) => (c.id === id ? { ...c, joined: next.joined, going: next.going } : c))
      : prev,
  )
}

export function nudgeCleanupInFlatLists(qc: QueryClient, id: string, joined: boolean): void {
  qc.setQueriesData<CleanupDTO[]>({ queryKey: CLEANUPS_LIST_PREFIX }, (prev) =>
    Array.isArray(prev)
      ? prev.map((c) =>
          c.id === id
            ? { ...c, joined, going: Math.max(0, c.going + (joined ? 1 : -1)) }
            : c,
        )
      : prev,
  )
}

function patchAttendeesGoing(qc: QueryClient, id: string, going: number): void {
  qc.setQueryData<CleanupAttendeesResponse>(queryKeys.cleanupAttendees(id), (prev) =>
    prev ? { ...prev, going } : prev,
  )
}

function nudgeAttendeesGoing(qc: QueryClient, id: string, joined: boolean): void {
  qc.setQueryData<CleanupAttendeesResponse>(queryKeys.cleanupAttendees(id), (prev) =>
    prev ? { ...prev, going: Math.max(0, prev.going + (joined ? 1 : -1)) } : prev,
  )
}

export function joinCleanupMutationOptions(
  qc: QueryClient,
  id: string,
  mutationFn: (currentlyJoined: boolean) => Promise<JoinCleanupResponse>,
): UseMutationOptions<JoinCleanupResponse, unknown, boolean, JoinCleanupCtx> {
  return {
    mutationFn,
    onMutate: async (currentlyJoined) => {
      await Promise.all([
        qc.cancelQueries(cleanupDetailFilters(id)),
        qc.cancelQueries({ queryKey: CLEANUPS_LIST_PREFIX }),
        qc.cancelQueries({ queryKey: queryKeys.cleanupAttendees(id) }),
      ])
      const prevDetails = qc.getQueriesData<CleanupDTO>(cleanupDetailFilters(id))
      const prevLists = qc.getQueriesData<CleanupDTO[]>({ queryKey: CLEANUPS_LIST_PREFIX })
      const prevAttendees = qc.getQueryData<CleanupAttendeesResponse>(queryKeys.cleanupAttendees(id))
      const joined = !currentlyJoined
      patchCleanupDetails(qc, id, (prev) => ({
        ...prev,
        joined,
        going: Math.max(0, prev.going + (joined ? 1 : -1)),
      }))
      const detail = getCachedCleanupDetail(qc, id)
      if (detail) {
        patchCleanupInFlatLists(qc, id, { joined: detail.joined, going: detail.going })
        patchAttendeesGoing(qc, id, detail.going)
      } else {
        nudgeCleanupInFlatLists(qc, id, joined)
        nudgeAttendeesGoing(qc, id, joined)
      }
      return { prevDetails, prevLists, prevAttendees }
    },
    onError: (_err, _currentlyJoined, ctx) => {
      if (!ctx) return
      for (const [key, data] of ctx.prevDetails) qc.setQueryData(key as unknown[], data)
      for (const [key, data] of ctx.prevLists) qc.setQueryData(key as unknown[], data)
      if (ctx.prevAttendees) qc.setQueryData(queryKeys.cleanupAttendees(id), ctx.prevAttendees)
    },
    onSuccess: (res) => {
      patchCleanupDetails(qc, id, (prev) => ({ ...prev, joined: res.joined, going: res.going }))
      patchCleanupInFlatLists(qc, id, { joined: res.joined, going: res.going })
      patchAttendeesGoing(qc, id, res.going)
    },
    onSettled: () => {
      void qc.invalidateQueries(cleanupDetailFilters(id))
      void qc.invalidateQueries({ queryKey: CLEANUPS_LIST_PREFIX })
      void qc.invalidateQueries({ queryKey: queryKeys.cleanupAttendees(id) })
    },
  }
}

export function rsvpErrorKey(code: string | undefined): string {
  if (code === "CONFLICT") return "error.closed"
  if (code === "FORBIDDEN") return "error.not_allowed"
  return "error.generic"
}

export function useJoinCleanup(id: string) {
  const api = useApi()
  const qc = useQueryClient()
  const toast = useToast()
  const { t } = useT("event-rsvp")

  const options = joinCleanupMutationOptions(qc, id, (currentlyJoined) =>
    currentlyJoined ? api.leaveCleanup({ id }) : api.joinCleanup({ id }),
  )
  return useMutation({
    ...options,
    onError: (err, currentlyJoined, ctx, mutationCtx) => {
      void options.onError?.(err, currentlyJoined, ctx, mutationCtx)
      toast.show(t(rsvpErrorKey(appErrorCode(err))), { variant: "error" })
    },
  })
}

export function useCreateCleanup() {
  const api = useApi()
  const qc = useQueryClient()

  return useMutation<CleanupDTO, unknown, CreateCleanupRequest>({
    mutationFn: (input) => api.createCleanup(input),
    onSuccess: (cleanup) => {
      qc.setQueryData<CleanupDTO>(queryKeys.cleanup(cleanup.id), cleanup)
      void qc.invalidateQueries({ queryKey: CLEANUPS_LIST_PREFIX })
    },
  })
}

export interface UpdateCleanupVars {
  id: string
  patch: Omit<UpdateCleanupRequest, "id">
}

export function useUpdateCleanup() {
  const api = useApi()
  const qc = useQueryClient()

  return useMutation<
    CleanupDTO,
    unknown,
    UpdateCleanupVars,
    { prevDetails: ReadonlyArray<readonly [readonly unknown[], CleanupDTO | undefined]> }
  >({
    mutationFn: ({ id, patch }) => api.updateCleanup({ ...patch, id }),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries(cleanupDetailFilters(id))
      const prevDetails = qc.getQueriesData<CleanupDTO>(cleanupDetailFilters(id))
      const scalarPatch = scalarCleanupPatch(patch)
      patchCleanupDetails(qc, id, (prev) => ({ ...prev, ...scalarPatch }))
      qc.setQueriesData<CleanupDTO[]>({ queryKey: CLEANUPS_LIST_PREFIX }, (prev) =>
        Array.isArray(prev)
          ? prev.map((c) => (c.id === id ? { ...c, ...scalarPatch } : c))
          : prev,
      )
      return { prevDetails }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) for (const [key, data] of ctx.prevDetails) qc.setQueryData(key as unknown[], data)
      void qc.invalidateQueries({ queryKey: CLEANUPS_LIST_PREFIX })
    },
    onSuccess: (cleanup) => {
      reconcileCleanupDetails(qc, cleanup.id, cleanup)
    },
    onSettled: (_data, _err, { id }) => {
      void qc.invalidateQueries(cleanupDetailFilters(id))
      void qc.invalidateQueries({ queryKey: CLEANUPS_LIST_PREFIX })
    },
  })
}

export interface CancelCleanupVars {
  id: string
  reason?: string
}

export function useCancelCleanup() {
  const api = useApi()
  const qc = useQueryClient()

  return useMutation<CleanupDTO, unknown, CancelCleanupVars>({
    mutationFn: ({ id, reason }) =>
      api.cancelCleanup({ id, ...(reason ? { reason } : {}) }),
    onSuccess: (cleanup) => {
      reconcileCleanupDetails(qc, cleanup.id, cleanup)
      void qc.invalidateQueries({ queryKey: CLEANUPS_LIST_PREFIX })
      void qc.invalidateQueries({ queryKey: queryKeys.cleanupAttendees(cleanup.id) })
    },
  })
}

export interface CompleteCleanupVars {
  id: string
  note?: string
}

export function completeCleanupMutationOptions(
  qc: QueryClient,
  mutationFn: (vars: CompleteCleanupVars) => Promise<CleanupDTO>,
): UseMutationOptions<CleanupDTO, unknown, CompleteCleanupVars> {
  return {
    mutationFn,
    onSuccess: (res, { id }) => {
      reconcileCleanupDetails(qc, id, res)
      void qc.invalidateQueries(cleanupDetailFilters(id))
      void qc.invalidateQueries({ queryKey: CLEANUPS_LIST_PREFIX })
      void qc.invalidateQueries({ queryKey: queryKeys.cleanupAttendees(id) })
      void qc.invalidateQueries({ queryKey: queryKeys.eventHours(id) })
    },
  }
}

export function useCompleteCleanup() {
  const api = useApi()
  const qc = useQueryClient()

  return useMutation<CleanupDTO, unknown, CompleteCleanupVars>(
    completeCleanupMutationOptions(qc, ({ id, note }) =>
      api.completeCleanup({ id, ...(note ? { note } : {}) }),
    ),
  )
}

export interface ClaimEventSlotVars {
  slotId: string | null
}

export function claimEventSlotMutationOptions(
  qc: QueryClient,
  cleanupId: string,
  mutationFn: (vars: ClaimEventSlotVars) => Promise<CleanupDTO>,
): UseMutationOptions<CleanupDTO, unknown, ClaimEventSlotVars> {
  return {
    mutationFn,
    onSuccess: (res) => {
      reconcileCleanupDetails(qc, cleanupId, res)
      patchCleanupInFlatLists(qc, cleanupId, { joined: res.joined, going: res.going })
      void qc.invalidateQueries({ queryKey: CLEANUPS_LIST_PREFIX })
      void qc.invalidateQueries({ queryKey: queryKeys.cleanupAttendees(cleanupId) })
    },
  }
}

export function useClaimEventSlot(cleanupId: string) {
  const api = useApi()
  const qc = useQueryClient()

  return useMutation(
    claimEventSlotMutationOptions(qc, cleanupId, ({ slotId }) =>
      api.claimEventSlot({ id: cleanupId, slotId }),
    ),
  )
}

export interface SetMemberRoleVars {
  id: string
  userId: string
  role: "cohost" | "member"
}

export function useSetMemberRole() {
  const api = useApi()
  const qc = useQueryClient()

  return useMutation<SetMemberRoleResponse, unknown, SetMemberRoleVars>({
    mutationFn: ({ id, userId, role }) => api.setCleanupMemberRole({ id, userId, role }),
    onSuccess: (_res, { id }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.cleanupAttendees(id) })
      void qc.invalidateQueries(cleanupDetailFilters(id))
    },
  })
}

export interface RemoveMemberVars {
  id: string
  userId: string
}

export function rosterWithoutMember(
  prev: CleanupAttendeesResponse | undefined,
  userId: string,
  going: number,
): CleanupAttendeesResponse | undefined {
  if (!prev) return prev
  return { ...prev, attendees: prev.attendees.filter((a) => a.id !== userId), going }
}

export function useRemoveMember() {
  const api = useApi()
  const qc = useQueryClient()

  return useMutation<RemoveMemberResponse, unknown, RemoveMemberVars>({
    mutationFn: ({ id, userId }) => api.removeCleanupMember({ id, userId }),
    onSuccess: (res, { id, userId }) => {
      qc.setQueryData<CleanupAttendeesResponse>(queryKeys.cleanupAttendees(id), (prev) =>
        rosterWithoutMember(prev, userId, res.going),
      )
      patchCleanupDetails(qc, id, (prev) => ({ ...prev, going: res.going }))
      void qc.invalidateQueries({ queryKey: queryKeys.cleanupAttendees(id) })
      void qc.invalidateQueries(cleanupDetailFilters(id))
      void qc.invalidateQueries({ queryKey: CLEANUPS_LIST_PREFIX })
    },
  })
}

export function useRequestEventResources(cleanupId: string) {
  const api = useApi()
  return useMutation<RequestEventResourcesResponse, unknown, { message: string }>({
    mutationFn: ({ message }) => api.requestEventResources({ id: cleanupId, message }),
  })
}

export type GuestRsvpRequestVars = Omit<GuestRsvpRequestRequest, "id">

export type GuestRsvpVerifyVars = Omit<GuestRsvpVerifyRequest, "id">

function patchCleanupGoingInFlatLists(qc: QueryClient, id: string, going: number): void {
  qc.setQueriesData<CleanupDTO[]>({ queryKey: CLEANUPS_LIST_PREFIX }, (prev) =>
    Array.isArray(prev)
      ? prev.map((c) =>
          c.id === id
            ? {
                ...c,
                going,
                ...(c.guestCount === undefined ? {} : { guestCount: c.guestCount + 1 }),
              }
            : c,
        )
      : prev,
  )
}

export function applyGuestRsvpToCaches(qc: QueryClient, id: string, going: number): void {
  patchCleanupDetails(qc, id, (prev) => ({
    ...prev,
    going,
    ...(prev.guestCount === undefined ? {} : { guestCount: prev.guestCount + 1 }),
  }))
  patchCleanupGoingInFlatLists(qc, id, going)
  patchAttendeesGoing(qc, id, going)
}

export function guestRsvpVerifyMutationOptions(
  qc: QueryClient,
  id: string,
  mutationFn: (vars: GuestRsvpVerifyVars) => Promise<GuestRsvpVerifyResponse>,
): UseMutationOptions<GuestRsvpVerifyResponse, unknown, GuestRsvpVerifyVars> {
  return {
    mutationFn,
    onSuccess: (res) => {
      applyGuestRsvpToCaches(qc, id, res.going)
      void qc.invalidateQueries(cleanupDetailFilters(id))
      void qc.invalidateQueries({ queryKey: CLEANUPS_LIST_PREFIX })
      void qc.invalidateQueries({ queryKey: queryKeys.cleanupAttendees(id) })
      void qc.invalidateQueries({ queryKey: queryKeys.cleanupGuests(id) })
    },
  }
}

export function useGuestRsvpRequest(cleanupId: string) {
  const api = useApi()
  return useMutation<GuestRsvpRequestResponse, unknown, GuestRsvpRequestVars>({
    mutationFn: (vars) => api.guestRsvpRequest({ id: cleanupId, ...vars }),
  })
}

export function useGuestRsvpVerify(cleanupId: string) {
  const api = useApi()
  const qc = useQueryClient()

  return useMutation(
    guestRsvpVerifyMutationOptions(qc, cleanupId, (vars) =>
      api.guestRsvpVerify({ id: cleanupId, ...vars }),
    ),
  )
}

export function useGuestRsvpCancel() {
  const api = useApi()
  return useMutation<GuestRsvpCancelResponse, unknown, GuestRsvpCancelRequest>({
    mutationFn: ({ token }) => api.guestRsvpCancel({ token }),
  })
}

export function useCleanupGuests(id: string | undefined, opts: { enabled?: boolean } = {}) {
  const api = useApi()
  return useInfiniteQuery<GetCleanupGuestsResponse>({
    queryKey: queryKeys.cleanupGuests(id ?? "unknown"),
    enabled: !!id && (opts.enabled ?? false),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.getCleanupGuests({
        id: id as string,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (lastPage: GetCleanupGuestsResponse) => lastPage.nextCursor ?? undefined,
    retry: false,
  })
}

function scalarCleanupPatch(patch: Omit<UpdateCleanupRequest, "id">): Partial<CleanupDTO> {
  const out: Partial<CleanupDTO> = {}
  if (patch.title !== undefined) out.title = patch.title
  if (patch.description !== undefined) out.description = patch.description
  if (patch.eventKind !== undefined) out.eventKind = patch.eventKind
  if (patch.type !== undefined) out.type = patch.type
  if (patch.scheduledAt !== undefined) out.scheduledAt = patch.scheduledAt
  if (patch.lat !== undefined) out.lat = patch.lat
  if (patch.lng !== undefined) out.lng = patch.lng
  if (patch.address !== undefined) out.address = patch.address
  if (patch.bring !== undefined) out.bring = patch.bring
  return out
}
