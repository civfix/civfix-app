import { useRef, useState } from "react"
import type { QueryClient } from "@tanstack/react-query"
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  AcceptEventTeamInviteResponse,
  AcceptMyEventInviteResponse,
  BroadcastDTO,
  BroadcastSegment,
  BroadcastStatus,
  CheckinResultDTO,
  CleanupMemberRole,
  CreateWalkupRegistrationRequest,
  CreateWalkupRegistrationResponse,
  DeclineMyEventInviteResponse,
  EventCheckinCountersDTO,
  EventInsights,
  EventRegistrationDTO,
  EventTeamInviteIdentifierKind,
  EventTeamRole,
  EventQuestionDTO,
  EventWaitlistEntryDTO,
  HostBroadcastChannel,
  HostCapability,
  HostedEventDTO,
  InviteEventTeamMemberResponse,
  ListEventRegistrationsResponse,
  ListEventTeamResponse,
  ListMyEventInvitesResponse,
  ListMyHostedEventsResponse,
  MarkEventNoShowsResponse,
  MyEventTicketDTO,
  PendingEventTeamInviteDTO,
  RegisterForEventRequest,
  RegisterForEventResponse,
  RegistrationRosterFilter,
  RevokeEventTeamInviteResponse,
  TicketTypeDTO,
} from "@civfix/shared"
import { hostCapabilities } from "@civfix/shared/host"
import { appErrorCode } from "../../bodies/errorCode"
import { useApi, useAuthState } from "../context"
import { queryKeys } from "../keys"
import { cleanupDetailFilters } from "./cleanups"

export const HOST_COUNTERS_POLL_MS = 20_000

export const INSIGHTS_LIVE_POLL_MS = HOST_COUNTERS_POLL_MS

export const INSIGHTS_IDLE_POLL_MS = 5 * 60_000

export const HOST_ROSTER_PAGE_SIZE = 50

export interface HostStandingView {
  myCapabilities: readonly HostCapability[]
  myRole?: CleanupMemberRole | null | undefined
}

const NO_LEGACY_CAPABILITIES: ReadonlySet<HostCapability> = hostCapabilities({
  eventRole: null,
  orgRole: null,
})

export function legacyRoleCapabilities(cleanup: HostStandingView): ReadonlySet<HostCapability> {
  if (cleanup.myCapabilities.length > 0) return NO_LEGACY_CAPABILITIES
  return hostCapabilities({ eventRole: cleanup.myRole ?? null, orgRole: null })
}

export function hasHostCapability(
  cleanup: HostStandingView | null | undefined,
  capability: HostCapability,
): boolean {
  if (!cleanup) return false
  if (cleanup.myCapabilities.includes(capability)) return true
  return legacyRoleCapabilities(cleanup).has(capability)
}

export function actsAsHost(cleanup: HostStandingView | null | undefined): boolean {
  return hasHostCapability(cleanup, "manage_event") || hasHostCapability(cleanup, "view_roster")
}

export function managesEvent(cleanup: HostStandingView | null | undefined): boolean {
  return hasHostCapability(cleanup, "manage_event")
}

export interface CleanupStandingSource {
  myCapabilities: readonly HostCapability[]
  myRole?: CleanupMemberRole | null | undefined
  organizer: { id: string }
}

export function cleanupHostStanding(
  cleanup: CleanupStandingSource | null | undefined,
  viewerId: string | null | undefined,
): HostStandingView | null {
  if (!cleanup) return null
  const fallbackRole: CleanupMemberRole | null =
    !!viewerId && cleanup.organizer.id === viewerId ? "organizer" : null
  return {
    myCapabilities: cleanup.myCapabilities,
    myRole: cleanup.myRole ?? fallbackRole,
  }
}

export function invalidateHostEvent(qc: QueryClient, cleanupId: string): void {
  void qc.invalidateQueries({ queryKey: queryKeys.hostEvent(cleanupId) })
  void qc.invalidateQueries({ queryKey: queryKeys.eventInsights(cleanupId) })
  void qc.invalidateQueries(cleanupDetailFilters(cleanupId))
}

export interface EventInsightsOptions {
  enabled?: boolean
  live?: boolean
}

export function useEventInsights(id: string | undefined, opts: EventInsightsOptions = {}) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  const enabled = !!id && isAuthenticated && (opts.enabled ?? true)
  return useQuery<EventInsights>({
    queryKey: queryKeys.eventInsights(id ?? "unknown"),
    enabled,
    queryFn: () => api.getEventInsights({ id: id as string }),
    refetchInterval: enabled ? (opts.live ? INSIGHTS_LIVE_POLL_MS : INSIGHTS_IDLE_POLL_MS) : false,
    placeholderData: (previous) => previous,
    retry: false,
  })
}

export function useMarkEventNoShows(id: string) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<MarkEventNoShowsResponse, unknown, void>({
    mutationFn: () => api.markEventNoShows({ id, all: true }),
    onSuccess: () => invalidateHostEvent(qc, id),
  })
}

export function useHostCounters(id: string | undefined, opts: { enabled?: boolean } = {}) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  const enabled = !!id && isAuthenticated && (opts.enabled ?? true)
  return useQuery<EventCheckinCountersDTO>({
    queryKey: queryKeys.hostCounters(id ?? "unknown"),
    enabled,
    queryFn: () => api.getEventCheckinCounters({ id: id as string }),
    refetchInterval: enabled ? HOST_COUNTERS_POLL_MS : false,
    retry: false,
  })
}

export interface HostRosterOptions {
  filter?: RegistrationRosterFilter
  q?: string
  enabled?: boolean
}

export function useHostRoster(id: string | undefined, opts: HostRosterOptions = {}) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  const filter = opts.filter ?? "all"
  const q = (opts.q ?? "").trim()
  return useInfiniteQuery<ListEventRegistrationsResponse>({
    queryKey: queryKeys.hostRoster(id ?? "unknown", filter, q),
    enabled: !!id && isAuthenticated && (opts.enabled ?? true),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.listEventRegistrations({
        id: id as string,
        limit: HOST_ROSTER_PAGE_SIZE,
        ...(filter !== "all" ? { filter } : {}),
        ...(q.length > 0 ? { q } : {}),
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (lastPage: ListEventRegistrationsResponse) => lastPage.nextCursor ?? undefined,
    retry: false,
  })
}

export function rosterRows(
  pages: readonly ListEventRegistrationsResponse[] | undefined,
): EventRegistrationDTO[] {
  return (pages ?? []).flatMap((page) => page.items)
}

export function useEventTicketTypes(id: string | undefined, opts: { enabled?: boolean } = {}) {
  const api = useApi()
  return useQuery<TicketTypeDTO[]>({
    queryKey: queryKeys.hostTicketTypes(id ?? "unknown"),
    enabled: !!id && (opts.enabled ?? true),
    queryFn: async () => (await api.listEventTicketTypes({ id: id as string })).items,
    retry: false,
  })
}

export function useEventQuestions(id: string | undefined, opts: { enabled?: boolean } = {}) {
  const api = useApi()
  return useQuery<EventQuestionDTO[]>({
    queryKey: queryKeys.hostQuestions(id ?? "unknown"),
    enabled: !!id && (opts.enabled ?? true),
    queryFn: async () => (await api.listEventQuestions({ id: id as string })).items,
    retry: false,
  })
}

export function useHostTeam(id: string | undefined, opts: { enabled?: boolean } = {}) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useQuery<ListEventTeamResponse>({
    queryKey: queryKeys.hostTeam(id ?? "unknown"),
    enabled: !!id && isAuthenticated && (opts.enabled ?? true),
    queryFn: () => api.listEventTeam({ id: id as string }),
    retry: false,
  })
}

export interface InviteEventTeamMemberVars {
  identifierKind: EventTeamInviteIdentifierKind
  identifier: string
  role: EventTeamRole
}

export function useInviteEventTeamMember(id: string) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<InviteEventTeamMemberResponse, unknown, InviteEventTeamMemberVars>({
    mutationFn: (vars) => api.inviteEventTeamMember({ ...vars, id }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.hostTeam(id) })
      invalidateHostEvent(qc, id)
    },
  })
}

export function useRevokeEventTeamInvite(id: string) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<RevokeEventTeamInviteResponse, unknown, { inviteId: string }>({
    mutationFn: ({ inviteId }) => api.revokeEventTeamInvite({ id, inviteId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.hostTeam(id) })
      invalidateHostEvent(qc, id)
    },
  })
}

export function useAcceptEventTeamInvite(id: string) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<AcceptEventTeamInviteResponse, unknown, { token: string }>({
    mutationFn: ({ token }) => api.acceptEventTeamInvite({ id, token }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.hostTeam(id) })
      invalidateMyEventInvites(qc)
      invalidateHostEvent(qc, id)
    },
  })
}

export function useHostWaitlist(id: string | undefined, opts: { enabled?: boolean } = {}) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useInfiniteQuery({
    queryKey: queryKeys.hostWaitlist(id ?? "unknown"),
    enabled: !!id && isAuthenticated && (opts.enabled ?? true),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.listEventWaitlist({
        id: id as string,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (lastPage: { nextCursor?: string | null }) => lastPage.nextCursor ?? undefined,
    retry: false,
  })
}

export function useMyEventTicket(id: string | undefined, opts: { enabled?: boolean } = {}) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useQuery<MyEventTicketDTO>({
    queryKey: queryKeys.myTickets(id ?? "unknown"),
    enabled: !!id && isAuthenticated && (opts.enabled ?? true),
    queryFn: () => api.getMyEventTicket({ id: id as string }),
    gcTime: 0,
    retry: false,
  })
}

export function useRegisterForEvent(id: string) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<RegisterForEventResponse, unknown, Omit<RegisterForEventRequest, "id">>({
    mutationFn: (input) => api.registerForEvent({ ...input, id }),
    onSuccess: (res) => {
      if (res.outcome !== "registered" && res.outcome !== "waitlisted" && res.outcome !== "replayed") {
        return
      }
      invalidateHostEvent(qc, id)
      void qc.invalidateQueries({ queryKey: queryKeys.myTickets(id) })
      void qc.invalidateQueries({ queryKey: ["cleanups"] })
    },
  })
}

export interface CancelRegistrationVars {
  registrationId: string
  reason?: string
}

export function useCancelEventRegistration(id: string) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ registrationId, reason }: CancelRegistrationVars) =>
      api.cancelEventRegistration({ id, registrationId, ...(reason ? { reason } : {}) }),
    onSuccess: () => {
      invalidateHostEvent(qc, id)
      void qc.invalidateQueries({ queryKey: queryKeys.myTickets(id) })
      void qc.invalidateQueries({ queryKey: ["cleanups"] })
    },
  })
}

export function useScanEventTicket(id: string) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<CheckinResultDTO, unknown, { token: string }>({
    mutationFn: ({ token }) => api.scanEventTicket({ id, token }),
    onSuccess: () => invalidateHostEvent(qc, id),
  })
}

export function useCheckInEventSeat(id: string) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<CheckinResultDTO, unknown, { seatId: string }>({
    mutationFn: ({ seatId }) => api.checkInEventSeat({ id, seatId, method: "manual" }),
    onSuccess: () => invalidateHostEvent(qc, id),
  })
}

export function useUndoEventCheckIn(id: string) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ seatId }: { seatId: string }) => api.undoEventCheckIn({ id, seatId }),
    onSuccess: () => invalidateHostEvent(qc, id),
  })
}

export function useWalkupRegistration(id: string) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<
    CreateWalkupRegistrationResponse,
    unknown,
    Omit<CreateWalkupRegistrationRequest, "id">
  >({
    mutationFn: (input) => api.createWalkupRegistration({ ...input, id }),
    onSuccess: () => invalidateHostEvent(qc, id),
  })
}

export function useJoinEventWaitlist(id: string) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<{ entry: EventWaitlistEntryDTO }, unknown, { ticketTypeId: string; partySize?: number }>({
    mutationFn: ({ ticketTypeId, partySize }) =>
      api.joinEventWaitlist({ id, ticketTypeId, partySize: partySize ?? 1 }),
    onSuccess: () => invalidateHostEvent(qc, id),
  })
}

export function useLeaveEventWaitlist(id: string) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ticketTypeId }: { ticketTypeId?: string } = {}) =>
      api.leaveEventWaitlist({ id, ...(ticketTypeId ? { ticketTypeId } : {}) }),
    onSuccess: () => invalidateHostEvent(qc, id),
  })
}

export interface QuickBroadcastVars {
  subject: string
  bodyMd: string
  segment: BroadcastSegment
}

export interface RetainedQuickDraft {
  id: string
  vars: QuickBroadcastVars
}

function sameSegment(a: BroadcastSegment, b: BroadcastSegment): boolean {
  if (a.kind !== b.kind) return false
  const aIds = "ids" in a ? a.ids : null
  const bIds = "ids" in b ? b.ids : null
  if (aIds === null || bIds === null) return aIds === bIds
  return aIds.length === bIds.length && aIds.every((id, index) => id === bIds[index])
}

export function sameQuickBroadcastVars(a: QuickBroadcastVars, b: QuickBroadcastVars): boolean {
  return a.subject === b.subject && a.bodyMd === b.bodyMd && sameSegment(a.segment, b.segment)
}

export function broadcastFanoutStarted(status: BroadcastStatus): boolean {
  return status === "sending" || status === "sent"
}

export type QuickBroadcastResult =
  | { kind: "sent"; broadcast: BroadcastDTO }
  | { kind: "edits_lost"; broadcast: BroadcastDTO }

export type QuickBroadcastDiscard = { kind: "discarded" } | { kind: "already_sending" }

export interface QuickBroadcastPorts {
  createDraft(vars: QuickBroadcastVars): Promise<{ id: string }>
  update(broadcastId: string, vars: QuickBroadcastVars): Promise<BroadcastDTO>
  send(broadcastId: string): Promise<BroadcastDTO>
  read(broadcastId: string): Promise<BroadcastDTO>
  discard(broadcastId: string): Promise<void>
  retainDraft(draft: RetainedQuickDraft): void
}

async function applyDraftEdits(
  ports: QuickBroadcastPorts,
  broadcastId: string,
  vars: QuickBroadcastVars,
): Promise<BroadcastDTO | null> {
  try {
    await ports.update(broadcastId, vars)
    return null
  } catch (err) {
    if (appErrorCode(err) !== "CONFLICT") throw err
    const current = await ports.read(broadcastId)
    if (!broadcastFanoutStarted(current.status)) throw err
    return current
  }
}

export async function sendQuickBroadcast(
  ports: QuickBroadcastPorts,
  vars: QuickBroadcastVars,
  retained: RetainedQuickDraft | null,
): Promise<QuickBroadcastResult> {
  let draft = retained
  if (draft === null) {
    const created = await ports.createDraft(vars)
    draft = { id: created.id, vars }
    ports.retainDraft(draft)
  } else if (!sameQuickBroadcastVars(draft.vars, vars)) {
    const started = await applyDraftEdits(ports, draft.id, vars)
    if (started !== null) return { kind: "edits_lost", broadcast: started }
    draft = { id: draft.id, vars }
    ports.retainDraft(draft)
  }
  try {
    return { kind: "sent", broadcast: await ports.send(draft.id) }
  } catch (err) {
    if (appErrorCode(err) !== "CONFLICT") throw err
    const current = await ports.read(draft.id)
    if (!broadcastFanoutStarted(current.status)) throw err
    return { kind: "sent", broadcast: current }
  }
}

export async function discardQuickBroadcast(
  ports: QuickBroadcastPorts,
  broadcastId: string,
): Promise<QuickBroadcastDiscard> {
  try {
    await ports.discard(broadcastId)
    return { kind: "discarded" }
  } catch (err) {
    const code = appErrorCode(err)
    if (code === "NOT_FOUND") return { kind: "discarded" }
    if (code !== "CONFLICT") throw err
    return { kind: "already_sending" }
  }
}

export const DEFAULT_QUICK_CHANNELS: readonly HostBroadcastChannel[] = ["inapp", "push"]

export function useQuickBroadcast(
  id: string,
  opts: { channels?: readonly HostBroadcastChannel[] } = {},
) {
  const api = useApi()
  const qc = useQueryClient()
  const channels = opts.channels ?? DEFAULT_QUICK_CHANNELS
  const draftRef = useRef<RetainedQuickDraft | null>(null)
  const [retainedDraft, setRetainedDraft] = useState<RetainedQuickDraft | null>(null)
  const ports: QuickBroadcastPorts = {
    createDraft: ({ subject, bodyMd, segment }) =>
      api.createEventBroadcast({ id, subject, bodyMd, segment, channels: [...channels] }),
    update: (broadcastId, { subject, bodyMd, segment }) =>
      api.updateEventBroadcast({ id, broadcastId, subject, bodyMd, segment }),
    send: (broadcastId) => api.sendEventBroadcast({ id, broadcastId }),
    read: (broadcastId) => api.getEventBroadcast({ id, broadcastId }),
    discard: async (broadcastId) => {
      await api.deleteEventBroadcast({ id, broadcastId })
    },
    retainDraft: (draft) => {
      draftRef.current = draft
      setRetainedDraft(draft)
    },
  }
  const release = () => {
    draftRef.current = null
    setRetainedDraft(null)
  }
  const mutation = useMutation<QuickBroadcastResult, unknown, QuickBroadcastVars>({
    mutationFn: (vars) => sendQuickBroadcast(ports, vars, draftRef.current),
    onSuccess: () => {
      release()
      invalidateHostEvent(qc, id)
    },
  })
  const discard = useMutation<QuickBroadcastDiscard, unknown, void>({
    mutationFn: async () => {
      const draft = draftRef.current
      if (draft === null) return { kind: "discarded" }
      return discardQuickBroadcast(ports, draft.id)
    },
    onSuccess: () => {
      release()
      invalidateHostEvent(qc, id)
    },
  })
  return { ...mutation, retainedDraft, discard }
}

export type HostedEventsWindow = "upcoming" | "past" | "all"

export function useMyHostedEvents(when: HostedEventsWindow = "upcoming", orgId: string | null = null) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useInfiniteQuery<ListMyHostedEventsResponse>({
    queryKey: queryKeys.hostedEvents(when, orgId),
    enabled: isAuthenticated,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.listMyHostedEvents({
        when,
        ...(orgId ? { orgId } : {}),
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (lastPage: ListMyHostedEventsResponse) => lastPage.nextCursor ?? undefined,
    retry: false,
  })
}

export function hostedEventRows(
  pages: readonly ListMyHostedEventsResponse[] | undefined,
): HostedEventDTO[] {
  return (pages ?? []).flatMap((page) => page.items)
}

export function invalidateMyEventInvites(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: queryKeys.myEventInvites })
  void qc.invalidateQueries({ queryKey: queryKeys.hostedEventsRoot })
  void qc.invalidateQueries({ queryKey: queryKeys.notificationsRoot })
}

export const MY_EVENT_INVITES_PAGE_SIZE = 50

export function useMyEventInvites(opts: { enabled?: boolean } = {}) {
  const api = useApi()
  const { isAuthenticated } = useAuthState()
  return useQuery<ListMyEventInvitesResponse>({
    queryKey: queryKeys.myEventInvites,
    enabled: isAuthenticated && (opts.enabled ?? true),
    queryFn: () => api.listMyEventInvites({ limit: MY_EVENT_INVITES_PAGE_SIZE }),
    retry: false,
  })
}

export function myEventInviteRows(
  page: ListMyEventInvitesResponse | undefined,
): PendingEventTeamInviteDTO[] {
  return page?.items ?? []
}

export function useAcceptMyEventInvite() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<AcceptMyEventInviteResponse, unknown, { inviteId: string }>({
    mutationFn: ({ inviteId }) => api.acceptMyEventInvite({ inviteId }),
    onSuccess: (res) => {
      invalidateMyEventInvites(qc)
      invalidateHostEvent(qc, res.event.id)
    },
  })
}

export function useDeclineMyEventInvite() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<DeclineMyEventInviteResponse, unknown, { inviteId: string }>({
    mutationFn: ({ inviteId }) => api.declineMyEventInvite({ inviteId }),
    onSuccess: () => invalidateMyEventInvites(qc),
  })
}
