import type {
  CleanupStatus,
  EventPhase,
  HostCapability,
  HostedEventDTO,
  HostPortfolioKpis,
  HostedEventsAnalyticsResponse,
  ListMyHostedEventsResponse,
  OrganizationDTO,
  OrganizationInviteDTO,
  OrganizationMemberDTO,
  OrganizationMemberRole,
  OrgInviteIdentifierKind,
} from "@civfix/shared"
import { ErrorCode, MAX_ORG_INVITES_PER_ORG, byErrorCode, type ErrorCodeTable } from "@civfix/shared"
import type { EventWhenInput } from "@civfix/shared/datetime"
import { wallClockInZone, wallClockToInstantMs, type WallClock } from "@civfix/shared/datetime"
import { can, deriveCleanupStatus, eventPhase, type EventWindowLike } from "@civfix/shared/host"
import { addWallClockDays, formInstantMs } from "../../calendarModel"
import { viewerTimeZone } from "../../../i18n"
import { DAY_MS } from "../../timeUnits"
import { hasHostCapability } from "../../../data/hooks/host"
import {
  hasActions,
  orderByRankThenName,
  pendingCount,
  type RosterMemberActions,
} from "../rosterModel"

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

export interface HostedEventActions {
  hostTools: boolean
  chat: boolean
  announce: boolean
  duplicate: boolean
  edit: boolean
}

export function hostedEventActions(event: HostedEventDTO, now: Date): HostedEventActions {
  const manage = hasHostCapability(event, "manage_event")
  const status = hostedEventStatus(event, now)
  return {
    hostTools: manage || hasHostCapability(event, "view_roster"),
    chat: status !== "cancelled",
    announce: hasHostCapability(event, "broadcast") && status !== "cancelled",
    duplicate: manage,
    edit: manage && status !== "done" && status !== "cancelled",
  }
}

export function hostedEventHasActions(actions: HostedEventActions): boolean {
  return (
    actions.hostTools ||
    actions.chat ||
    actions.announce ||
    actions.duplicate ||
    actions.edit
  )
}

function orgRoleCan(
  role: OrganizationMemberRole | null | undefined,
  capability: HostCapability,
): boolean {
  return can({ eventRole: null, orgRole: role ?? null }, capability)
}

export function canManageOrgTeam(role: OrganizationMemberRole | null | undefined): boolean {
  return orgRoleCan(role, "manage_org_members")
}

/**
 * Only the owner may change a member's role, while any manager may remove a member the server
 * marked `canRemove`; this matches the web console, and the two surfaces have to agree.
 */
export function canSetOrgMemberRole(role: OrganizationMemberRole | null | undefined): boolean {
  return role === "owner"
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

export function orgInviteQuotaReached(invites: readonly OrganizationInviteDTO[]): boolean {
  return pendingCount(invites) >= MAX_ORG_INVITES_PER_ORG
}

export function pendingOrgInvites(
  invites: readonly OrganizationInviteDTO[],
): OrganizationInviteDTO[] {
  return invites.filter((invite) => invite.status === "pending")
}

const ORG_MEMBER_ROLE_ORDER: readonly OrganizationMemberRole[] = ["owner", "admin", "member"]

export function orderedOrgMembers(
  members: readonly OrganizationMemberDTO[],
): OrganizationMemberDTO[] {
  return orderByRankThenName(ORG_MEMBER_ROLE_ORDER, members)
}

export type OrgMemberActions = RosterMemberActions<OrgSettableRole>

export type OrgSettableRole = "admin" | "member"

export const ORG_SETTABLE_ROLES: readonly OrgSettableRole[] = ["admin", "member"]

export const NO_ORG_MEMBER_ACTIONS: OrgMemberActions = { roles: [], canRemove: false }

export function orgMemberActions(input: {
  member: OrganizationMemberDTO
  viewerId: string | null
  canManage: boolean
  canSetRole: boolean
  lastAdmin: boolean
}): OrgMemberActions {
  const { member, viewerId, canManage, canSetRole, lastAdmin } = input
  if (!canManage) return NO_ORG_MEMBER_ACTIONS
  if (member.person.deleted) return NO_ORG_MEMBER_ACTIONS
  if (member.role === "owner") return NO_ORG_MEMBER_ACTIONS
  if (viewerId !== null && member.person.id === viewerId) return NO_ORG_MEMBER_ACTIONS
  const holdsTheLastAdminSeat = lastAdmin && member.role === "admin"
  return {
    roles:
      canSetRole && !holdsTheLastAdminSeat
        ? ORG_SETTABLE_ROLES.filter((role) => role !== member.role)
        : [],
    canRemove: member.canRemove && !holdsTheLastAdminSeat,
  }
}

export function orgMemberHasActions(actions: OrgMemberActions): boolean {
  return hasActions(actions)
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

const DUPLICATE_ERROR_KEYS: ErrorCodeTable<string> = {
  [ErrorCode.FORBIDDEN]: "events.duplicate_error_forbidden",
  [ErrorCode.NOT_FOUND]: "events.duplicate_error_gone",
  [ErrorCode.RATE_LIMITED]: "events.duplicate_error_rate_limited",
  [ErrorCode.VALIDATION]: "events.duplicate_error_invalid",
}

export function duplicateErrorKey(code: string | undefined): string {
  return byErrorCode(code, DUPLICATE_ERROR_KEYS, "events.duplicate_error_generic")
}

export function orgInviteIdentifierErrorKey(kind: OrgInviteIdentifierKind): string {
  return kind === "email" ? "team.invite_email_invalid" : "team.invite_handle_invalid"
}

const ORG_INVITE_ERROR_KEYS: ErrorCodeTable<string> = {
  [ErrorCode.NOT_FOUND]: "team.invite_error_no_account",
  [ErrorCode.CONFLICT]: "team.invite_error_conflict",
  [ErrorCode.FORBIDDEN]: "team.invite_error_forbidden",
  [ErrorCode.RATE_LIMITED]: "team.invite_error_rate_limited",
  [ErrorCode.VALIDATION]: "team.invite_error_invalid",
}

export function orgInviteErrorKey(code: string | undefined): string {
  return byErrorCode(code, ORG_INVITE_ERROR_KEYS, "team.invite_error_generic")
}

const COLLABORATOR_ERROR_KEYS: ErrorCodeTable<string> = {
  [ErrorCode.CONFLICT]: "team.error_conflict",
  [ErrorCode.FORBIDDEN]: "team.error_forbidden",
  [ErrorCode.NOT_FOUND]: "team.error_gone",
}

export function collaboratorErrorKey(code: string | undefined): string {
  return byErrorCode(code, COLLABORATOR_ERROR_KEYS, "team.error_generic")
}
