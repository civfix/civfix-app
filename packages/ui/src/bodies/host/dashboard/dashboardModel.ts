import type {
  HostCapability,
  HostedEventDTO,
  OrgBalanceDTO,
  OrganizationDTO,
  OrganizationInviteDTO,
  OrganizationMemberDTO,
  OrganizationMemberRole,
  OrgInviteIdentifierKind,
  SeriesPoint,
  SuppressedRate,
} from "@civfix/shared"
import { MAX_ORG_INVITES_PER_ORG } from "@civfix/shared"
import { can, hostCapabilities } from "@civfix/shared/host"

export const DASHBOARD_TABS = ["personal", "org"] as const
export type DashboardTab = (typeof DASHBOARD_TABS)[number]

export const DASHBOARD_RANGES = ["30d", "90d", "365d"] as const
export type DashboardRange = (typeof DASHBOARD_RANGES)[number]

export const DEFAULT_DASHBOARD_RANGE: DashboardRange = "30d"

export const SPARKLINE_MIN_POINTS = 2

export const SPARKLINE_MAX_BARS = 30

const DAY_MS = 86_400_000

const RANGE_DAYS: Readonly<Record<DashboardRange, number>> = {
  "30d": 30,
  "90d": 90,
  "365d": 365,
}

export interface DashboardTabsInput {
  orgs: readonly OrganizationDTO[]
  requestedTab: DashboardTab
  requestedOrgId: string | null
}

export interface DashboardTabsModel {
  tab: DashboardTab
  orgTabVisible: boolean
  orgPickerVisible: boolean
  selectedOrgId: string | null
  selectedOrg: OrganizationDTO | null
}

export function buildDashboardTabs(input: DashboardTabsInput): DashboardTabsModel {
  const { orgs, requestedTab, requestedOrgId } = input
  const orgTabVisible = orgs.length > 0
  const tab: DashboardTab = requestedTab === "org" && orgTabVisible ? "org" : "personal"
  const selected = orgs.find((org) => org.id === requestedOrgId) ?? orgs[0] ?? null
  return {
    tab,
    orgTabVisible,
    orgPickerVisible: tab === "org" && orgs.length > 1,
    selectedOrgId: selected?.id ?? null,
    selectedOrg: selected,
  }
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

export function hostedEventActions(event: HostedEventStanding): HostedEventActions {
  const caps = hostedEventCapabilities(event)
  const manage = caps.has("manage_event")
  return {
    hostTools: manage || caps.has("view_roster"),
    emailAttendees: caps.has("broadcast"),
    duplicate: manage,
    edit: manage,
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
  return orgRoleCan(role, "manage_team")
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

export function suppressed(value: number | null | undefined): boolean {
  return value === null || value === undefined
}

export function rateShowable(rate: SuppressedRate | null | undefined): boolean {
  return !!rate && rate.value !== null && !rate.suppressed
}

export function seriesChartable(points: readonly SeriesPoint[]): boolean {
  return points.filter((point) => point.value !== null).length >= SPARKLINE_MIN_POINTS
}

export interface SparklineBar {
  height: number
  suppressed: boolean
}

export function sparklineBars(points: readonly SeriesPoint[]): SparklineBar[] {
  const tail = points.slice(-SPARKLINE_MAX_BARS)
  const peak = tail.reduce((top, point) => Math.max(top, point.value ?? 0), 0)
  return tail.map((point) => ({
    height: peak > 0 && point.value !== null ? point.value / peak : 0,
    suppressed: point.value === null || point.suppressed,
  }))
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
}): OrgMemberActions {
  const { member, viewerId, canManage } = input
  if (!canManage) return NO_ORG_MEMBER_ACTIONS
  if (member.person.deleted) return NO_ORG_MEMBER_ACTIONS
  if (member.role === "owner") return NO_ORG_MEMBER_ACTIONS
  if (viewerId !== null && member.person.id === viewerId) return NO_ORG_MEMBER_ACTIONS
  return {
    roles: ORG_SETTABLE_ROLES.filter((role) => role !== member.role),
    canRemove: member.canRemove,
  }
}

export function orgMemberHasActions(actions: OrgMemberActions): boolean {
  return actions.roles.length > 0 || actions.canRemove
}

export function donationSummaryFrom(range: DashboardRange, now: Date): string {
  return new Date(now.getTime() - RANGE_DAYS[range] * DAY_MS).toISOString()
}

export function nextDuplicateStart(startsAt: string, now: Date): Date {
  const original = new Date(startsAt)
  if (Number.isNaN(original.getTime())) return new Date(now.getTime() + 7 * DAY_MS)
  if (original.getTime() > now.getTime()) return original
  const weeks = Math.ceil((now.getTime() - original.getTime()) / (7 * DAY_MS))
  return new Date(original.getTime() + weeks * 7 * DAY_MS)
}

export function duplicateReady(date: Date | null, time: Date | null, now: Date): boolean {
  if (!date || !time) return false
  const merged = new Date(date)
  merged.setHours(time.getHours(), time.getMinutes(), 0, 0)
  return merged.getTime() > now.getTime()
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
