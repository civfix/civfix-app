import type {
  CleanupStatus,
  EventPhase,
  HostCapability,
  HostedEventDTO,
  HostPortfolioKpis,
  HostedEventsAnalyticsResponse,
  ListMyHostedEventsResponse,
  OrgBalanceDTO,
  OrganizationDTO,
  OrganizationInviteDTO,
  OrganizationMemberDTO,
  OrganizationMemberRole,
  OrgInviteIdentifierKind,
} from "@civfix/shared"
import { MAX_ORG_INVITES_PER_ORG } from "@civfix/shared"
import type { EventWhenInput } from "@civfix/shared/datetime"
import { wallClockInZone, wallClockToInstantMs, type WallClock } from "@civfix/shared/datetime"
import {
  can,
  deriveCleanupStatus,
  eventEndsAtMs,
  eventPhase,
  hostCapabilities,
  hostStage,
  type EventWindowLike,
  type HostStage,
} from "@civfix/shared/host"
import { addWallClockDays, formInstantMs } from "../../calendarModel"
import { viewerTimeZone } from "../../../i18n"

export const DASHBOARD_RANGES = ["30d", "90d", "365d"] as const
export type DashboardRange = (typeof DASHBOARD_RANGES)[number]

export const DEFAULT_DASHBOARD_RANGE: DashboardRange = "30d"

export const ATTENTION_MAX_ROWS = 3

const DAY_MS = 86_400_000

const RANGE_DAYS: Readonly<Record<DashboardRange, number>> = {
  "30d": 30,
  "90d": 90,
  "365d": 365,
}

export interface DashboardScope {
  orgId: string | null
  org: OrganizationDTO | null
  selectorVisible: boolean
}

export function dashboardScope(
  orgs: readonly OrganizationDTO[],
  requestedOrgId: string | null,
): DashboardScope {
  const org = orgs.find((candidate) => candidate.id === requestedOrgId) ?? null
  return { orgId: org?.id ?? null, org, selectorVisible: orgs.length > 0 }
}

export interface HostedEventStanding {
  myCapabilities: readonly HostCapability[]
  myRole?: HostedEventDTO["myRole"]
}

export function hostedEventCapabilities(
  event: HostedEventStanding,
): ReadonlySet<HostCapability> {
  if (event.myCapabilities.length > 0) return new Set(event.myCapabilities)
  return hostCapabilities({ eventRole: event.myRole ?? null, orgRole: null })
}

export function hostedEventCan(event: HostedEventStanding, capability: HostCapability): boolean {
  return hostedEventCapabilities(event).has(capability)
}

export interface HostedEventActions {
  hostTools: boolean
  emailAttendees: boolean
  duplicate: boolean
  edit: boolean
}

export const NO_HOSTED_EVENT_ACTIONS: HostedEventActions = {
  hostTools: false,
  emailAttendees: false,
  duplicate: false,
  edit: false,
}

export function hostedEventActions(event: HostedEventDTO, now: Date): HostedEventActions {
  const caps = hostedEventCapabilities(event)
  const manage = caps.has("manage_event")
  const status = hostedEventStatus(event, now)
  return {
    hostTools: manage || caps.has("view_roster"),
    emailAttendees: caps.has("broadcast") && status !== "cancelled",
    duplicate: manage,
    edit: manage && status !== "done" && status !== "cancelled",
  }
}

export function hostedEventHasActions(actions: HostedEventActions): boolean {
  return actions.hostTools || actions.emailAttendees || actions.duplicate || actions.edit
}

export function orgRoleCan(
  role: OrganizationMemberRole | null | undefined,
  capability: HostCapability,
): boolean {
  return can({ eventRole: null, orgRole: role ?? null }, capability)
}

export function canManageOrgTeam(role: OrganizationMemberRole | null | undefined): boolean {
  return orgRoleCan(role, "manage_org_members")
}

/**
 * Changing a member's ROLE is owner-shaped, matching the web console's
 * "Only the owner can change roles." refusal. Removal is not: the console lets any manager remove
 * a member the server marked `canRemove`, and the two surfaces have to agree.
 */
export function canSetOrgMemberRole(role: OrganizationMemberRole | null | undefined): boolean {
  return role === "owner"
}

export function canViewOrgMoney(role: OrganizationMemberRole | null | undefined): boolean {
  return orgRoleCan(role, "view_donations")
}

export function canManageOrgPayments(role: OrganizationMemberRole | null | undefined): boolean {
  return orgRoleCan(role, "manage_payments")
}

export type PayoutBlockReason = "role" | "payouts_disabled" | "no_balance" | null

export interface PayoutButtonInput {
  role: OrganizationMemberRole | null | undefined
  balance: OrgBalanceDTO | null | undefined
  pending: boolean
}

export interface PayoutButtonModel {
  visible: boolean
  enabled: boolean
  reason: PayoutBlockReason
}

export function payoutButtonModel(input: PayoutButtonInput): PayoutButtonModel {
  const { role, balance, pending } = input
  if (!canManageOrgPayments(role)) {
    return { visible: false, enabled: false, reason: "role" }
  }
  if (!balance) return { visible: true, enabled: false, reason: null }
  if (!balance.payoutsEnabled) {
    return { visible: true, enabled: false, reason: "payouts_disabled" }
  }
  if (balance.available.amountMinor <= 0) {
    return { visible: true, enabled: false, reason: "no_balance" }
  }
  return { visible: true, enabled: !pending, reason: null }
}

export function payoutBlockedKey(reason: PayoutBlockReason): string | null {
  if (reason === "payouts_disabled") return "money.payout_blocked_disabled"
  if (reason === "no_balance") return "money.payout_blocked_empty"
  return null
}

export function portfolioKpis(
  pages: readonly ListMyHostedEventsResponse[] | undefined,
): HostPortfolioKpis | null {
  return pages?.[0]?.kpis ?? null
}

export function hostedEventWindow(event: HostedEventDTO): EventWindowLike {
  return { status: event.status, scheduledAt: event.startsAt, endsAt: event.endsAt ?? null }
}

export function hostedEventWhen(event: HostedEventDTO): EventWhenInput {
  return { ...hostedEventWindow(event), timezone: event.timezone ?? null }
}

export function hostedEventPhase(event: HostedEventDTO, now: Date): EventPhase {
  return eventPhase(hostedEventWindow(event), now.getTime())
}

export function hostedEventStatus(event: HostedEventDTO, now: Date): CleanupStatus {
  return deriveCleanupStatus(hostedEventWindow(event), now.getTime())
}

export function hostedEventStage(event: HostedEventDTO, now: Date): HostStage {
  return hostStage(hostedEventWindow(event), now.getTime())
}

export interface NextUpModel {
  event: HostedEventDTO
  phase: EventPhase
}

export function nextUpEvent(
  events: readonly HostedEventDTO[],
  now: Date,
): NextUpModel | null {
  const dated = events
    .map((event) => ({
      event,
      phase: hostedEventPhase(event, now),
      status: hostedEventStatus(event, now),
      at: Date.parse(event.startsAt),
    }))
    .filter((entry) => entry.status === "upcoming" || entry.status === "active")
    .sort((a, b) => {
      if (a.phase !== b.phase) return a.phase === "live" ? -1 : 1
      const left = Number.isFinite(a.at) ? a.at : Number.MAX_SAFE_INTEGER
      const right = Number.isFinite(b.at) ? b.at : Number.MAX_SAFE_INTEGER
      return left - right
    })
  const first = dated[0]
  return first ? { event: first.event, phase: first.phase } : null
}

export type AttentionRowKind = "log_hours"

export interface AttentionRow {
  kind: AttentionRowKind
  event: HostedEventDTO
}

export interface AttentionRowsInput {
  past: readonly HostedEventDTO[]
  now: Date
}

function attentionKind(event: HostedEventDTO, now: Date): AttentionRowKind | null {
  if (hostedEventStatus(event, now) !== "done") return null
  if (!hostedEventCan(event, "manage_event")) return null
  if (event.checkedInCount > 0 && (event.hoursCredited ?? 0) === 0) return "log_hours"
  return null
}

function endedAt(event: HostedEventDTO): number {
  return eventEndsAtMs(hostedEventWindow(event)) ?? 0
}

export function attentionRows(input: AttentionRowsInput): AttentionRow[] {
  const rows: AttentionRow[] = []
  for (const event of input.past) {
    const kind = attentionKind(event, input.now)
    if (kind) rows.push({ kind, event })
  }
  return rows.sort((a, b) => endedAt(b.event) - endedAt(a.event))
}

export type ImpactHeroUnit = "hours" | "volunteers"

export interface ImpactModel {
  hero: { value: number; unit: ImpactHeroUnit }
  volunteersCredited: number | null
  uniqueAttendees: number
  events: number
  showedUp: number | null
  cameBack: number | null
}

export function impactModel(
  analytics: HostedEventsAnalyticsResponse | undefined,
): ImpactModel | null {
  if (!analytics) return null
  const { totals, averageCheckInRate, repeatAttendance } = analytics
  const uniqueAttendees = totals.uniqueAttendees ?? 0
  if (uniqueAttendees === 0) return null
  const events = totals.events ?? 0
  const totalHours = analytics.totalHours ?? 0
  const registrations = totals.registrations ?? 0
  return {
    hero:
      totalHours > 0
        ? { value: totalHours, unit: "hours" }
        : { value: uniqueAttendees, unit: "volunteers" },
    volunteersCredited: analytics.volunteersCredited ?? null,
    uniqueAttendees,
    events,
    showedUp: registrations > 0 ? averageCheckInRate.value : null,
    cameBack: events >= 2 ? repeatAttendance.value : null,
  }
}

export function firstEventState(
  kpis: HostPortfolioKpis | null,
  upcoming: readonly HostedEventDTO[],
): boolean {
  return kpis !== null && kpis.eventsHosted === 0 && upcoming.length === 0
}

export type PastHoursToken = "hours" | "not_logged"

export interface PastRowMeta {
  cancelled: boolean
  showedUp: boolean
  hoursToken: PastHoursToken | null
}

export function pastRowMeta(event: HostedEventDTO): PastRowMeta {
  if (event.status === "cancelled") {
    return { cancelled: true, showedUp: false, hoursToken: null }
  }
  const credited = event.hoursCredited ?? 0
  return {
    cancelled: false,
    showedUp: event.registeredCount > 0,
    hoursToken:
      credited > 0 ? "hours" : event.checkedInCount > 0 ? "not_logged" : null,
  }
}

export function sharePathFor(event: HostedEventDTO): string {
  return `/cleanups/${event.pageSlug ?? event.referenceCode ?? event.id}`
}

export function orgInviteQuotaReached(invites: readonly OrganizationInviteDTO[]): boolean {
  return pendingOrgInvites(invites).length >= MAX_ORG_INVITES_PER_ORG
}

export function pendingOrgInvites(
  invites: readonly OrganizationInviteDTO[],
): OrganizationInviteDTO[] {
  return invites.filter((invite) => invite.status === "pending")
}

export const ORG_MEMBER_ROLE_ORDER: readonly OrganizationMemberRole[] = ["owner", "admin", "member"]

export function orgMemberRank(role: OrganizationMemberRole): number {
  const at = ORG_MEMBER_ROLE_ORDER.indexOf(role)
  return at === -1 ? ORG_MEMBER_ROLE_ORDER.length : at
}

export function orderedOrgMembers(
  members: readonly OrganizationMemberDTO[],
): OrganizationMemberDTO[] {
  return [...members].sort((a, b) => {
    const byRank = orgMemberRank(a.role) - orgMemberRank(b.role)
    if (byRank !== 0) return byRank
    return a.person.name.localeCompare(b.person.name)
  })
}

export interface OrgMemberActions {
  roles: readonly OrgSettableRole[]
  canRemove: boolean
}

export type OrgSettableRole = "admin" | "member"

export const ORG_SETTABLE_ROLES: readonly OrgSettableRole[] = ["admin", "member"]

export const NO_ORG_MEMBER_ACTIONS: OrgMemberActions = { roles: [], canRemove: false }

export function orgMemberActions(input: {
  member: OrganizationMemberDTO
  viewerId: string | null
  canManage: boolean
  canSetRole: boolean
}): OrgMemberActions {
  const { member, viewerId, canManage, canSetRole } = input
  if (!canManage) return NO_ORG_MEMBER_ACTIONS
  if (member.person.deleted) return NO_ORG_MEMBER_ACTIONS
  if (member.role === "owner") return NO_ORG_MEMBER_ACTIONS
  if (viewerId !== null && member.person.id === viewerId) return NO_ORG_MEMBER_ACTIONS
  return {
    roles: canSetRole ? ORG_SETTABLE_ROLES.filter((role) => role !== member.role) : [],
    canRemove: member.canRemove,
  }
}

export function orgMemberHasActions(actions: OrgMemberActions): boolean {
  return actions.roles.length > 0 || actions.canRemove
}

/**
 * The start of the donation window, floored to the UTC day so the value - and the cache key built
 * from it - is stable for every mount within the same day rather than minting a fresh key per render.
 */
export function donationSummaryFrom(range: DashboardRange, now: Date): string {
  const start = new Date(now.getTime() - RANGE_DAYS[range] * DAY_MS)
  start.setUTCHours(0, 0, 0, 0)
  return start.toISOString()
}

export interface DuplicateStartSeed {
  instantMs: number
  wallClock: WallClock
}

const MAX_DUPLICATE_ROLLS = 60

export function nextDuplicateStart(
  startsAt: string,
  timezone: string | null | undefined,
  now: Date,
): DuplicateStartSeed {
  const zone = timezone ?? viewerTimeZone()
  const parsed = Date.parse(startsAt)
  const seed = Number.isNaN(parsed) ? now.getTime() + 7 * DAY_MS : parsed
  const behindMs = now.getTime() - seed
  const weeks = behindMs > 0 ? Math.ceil(behindMs / (7 * DAY_MS)) : 0
  let wallClock = addWallClockDays(wallClockInZone(seed, zone), weeks * 7)

  for (let roll = 0; roll < MAX_DUPLICATE_ROLLS; roll++) {
    const instantMs = wallClockToInstantMs(wallClock, zone)
    if (instantMs !== null && instantMs > now.getTime()) return { instantMs, wallClock }
    wallClock =
      instantMs === null
        ? { ...wallClock, hours: (wallClock.hours + 1) % 24 }
        : addWallClockDays(wallClock, 7)
  }

  const fallback = now.getTime() + 7 * DAY_MS
  return { instantMs: fallback, wallClock: wallClockInZone(fallback, zone) }
}

export function duplicateReady(
  date: Date | null,
  time: Date | null,
  timezone: string | null | undefined,
  now: Date,
): boolean {
  if (!date || !time) return false
  const at = formInstantMs(date, time, timezone ?? viewerTimeZone())
  return at !== null && at > now.getTime()
}

export function duplicateErrorKey(code: string | undefined): string {
  if (code === "FORBIDDEN") return "events.duplicate_error_forbidden"
  if (code === "NOT_FOUND") return "events.duplicate_error_gone"
  if (code === "RATE_LIMITED") return "events.duplicate_error_rate_limited"
  if (code === "VALIDATION") return "events.duplicate_error_invalid"
  return "events.duplicate_error_generic"
}

export function payoutErrorKey(code: string | undefined): string {
  if (code === "VALIDATION") return "money.payout_error_invalid"
  if (code === "CONFLICT") return "money.payout_error_conflict"
  if (code === "FORBIDDEN") return "money.payout_error_forbidden"
  if (code === "RATE_LIMITED") return "money.payout_error_rate_limited"
  return "money.payout_error_generic"
}

export function orgInviteIdentifierErrorKey(kind: OrgInviteIdentifierKind): string {
  return kind === "email" ? "team.invite_email_invalid" : "team.invite_handle_invalid"
}

export function orgInviteErrorKey(code: string | undefined): string {
  if (code === "NOT_FOUND") return "team.invite_error_no_account"
  if (code === "CONFLICT") return "team.invite_error_conflict"
  if (code === "FORBIDDEN") return "team.invite_error_forbidden"
  if (code === "RATE_LIMITED") return "team.invite_error_rate_limited"
  if (code === "VALIDATION") return "team.invite_error_invalid"
  return "team.invite_error_generic"
}

export function collaboratorErrorKey(code: string | undefined): string {
  if (code === "CONFLICT") return "team.error_conflict"
  if (code === "FORBIDDEN") return "team.error_forbidden"
  if (code === "NOT_FOUND") return "team.error_gone"
  return "team.error_generic"
}
