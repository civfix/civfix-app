import type {
  CleanupMemberRole,
  EventTeamInviteDTO,
  EventTeamInviteIdentifierKind,
  EventTeamMemberDTO,
} from "@civfix/shared"
import { MAX_TEAM_INVITES_PER_EVENT, isValidHandle } from "@civfix/shared"
import { GUEST_EMAIL_MAX, guestEmailValue } from "./registration/guestRsvpModel"
import { settableRolesOtherThan, type SettableEventMemberRole } from "../../data/eventTeamTiers"
import {
  errorKeyFor,
  hasActions,
  orderByRankThenName,
  pendingCount,
  rankIn,
  type RosterMemberActions,
} from "./rosterModel"

export const TEAM_MEMBER_ROLE_ORDER: readonly CleanupMemberRole[] = [
  "organizer",
  "cohost",
  "coordinator",
  "staff",
  "member",
]

export const INVITE_IDENTIFIER_MAX = GUEST_EMAIL_MAX

export function teamMemberRank(role: CleanupMemberRole): number {
  return rankIn(TEAM_MEMBER_ROLE_ORDER, role)
}

export function orderedTeamMembers(
  members: readonly EventTeamMemberDTO[],
): EventTeamMemberDTO[] {
  return orderByRankThenName(TEAM_MEMBER_ROLE_ORDER, members)
}

export type TeamMemberActions = RosterMemberActions<SettableEventMemberRole>

export const NO_TEAM_MEMBER_ACTIONS: TeamMemberActions = { roles: [], canRemove: false }

export function teamMemberActions(input: {
  member: EventTeamMemberDTO
  viewerId: string | null
  canManageTeam: boolean
}): TeamMemberActions {
  const { member, viewerId, canManageTeam } = input
  if (!canManageTeam) return NO_TEAM_MEMBER_ACTIONS
  if (member.person.deleted) return NO_TEAM_MEMBER_ACTIONS
  if (member.role === "organizer") return NO_TEAM_MEMBER_ACTIONS
  if (viewerId !== null && member.person.id === viewerId) return NO_TEAM_MEMBER_ACTIONS
  return {
    roles: member.canChangeRole ? settableRolesOtherThan(member.role) : [],
    canRemove: member.canRemove,
  }
}

export function teamMemberHasActions(actions: TeamMemberActions): boolean {
  return hasActions(actions)
}

export function orderedTeamInvites(
  invites: readonly EventTeamInviteDTO[],
): EventTeamInviteDTO[] {
  return [...invites].sort((a, b) => {
    const byStatus = Number(b.status === "pending") - Number(a.status === "pending")
    if (byStatus !== 0) return byStatus
    return b.createdAt.localeCompare(a.createdAt)
  })
}

export function pendingInviteCount(invites: readonly EventTeamInviteDTO[]): number {
  return pendingCount(invites)
}

export function inviteQuotaReached(invites: readonly EventTeamInviteDTO[]): boolean {
  return pendingInviteCount(invites) >= MAX_TEAM_INVITES_PER_EVENT
}

export function inviteDisplayName(invite: EventTeamInviteDTO, fallback: string): string {
  const name = invite.invitee?.name?.trim()
  if (name) return name
  const masked = invite.maskedEmail?.trim()
  if (masked) return masked
  return fallback
}

export function inviteIdentifierValue(
  kind: EventTeamInviteIdentifierKind,
  raw: string,
): string | null {
  if (kind === "email") return guestEmailValue(raw)
  const handle = raw.trim().replace(/^@/, "")
  return isValidHandle(handle) ? handle : null
}

export function inviteIdentifierErrorKey(kind: EventTeamInviteIdentifierKind): string {
  return kind === "email" ? "invite.email_invalid" : "invite.handle_invalid"
}

const INVITE_ERROR_KEYS: ReadonlyMap<string, string> = new Map([
  ["NOT_FOUND", "invite.error_no_account"],
  ["CONFLICT", "invite.error_conflict"],
  ["FORBIDDEN", "invite.error_forbidden"],
  ["RATE_LIMITED", "invite.error_rate_limited"],
  ["VALIDATION", "invite.error_invalid"],
])

export function inviteErrorKey(code: string | undefined): string {
  return errorKeyFor(INVITE_ERROR_KEYS, code, "invite.error_generic")
}

const TEAM_MANAGE_ERROR_KEYS: ReadonlyMap<string, string> = new Map([
  ["CONFLICT", "manage.error_conflict"],
  ["FORBIDDEN", "manage.error_forbidden"],
  ["NOT_FOUND", "manage.error_gone"],
])

export function teamManageErrorKey(code: string | undefined): string {
  return errorKeyFor(TEAM_MANAGE_ERROR_KEYS, code, "manage.error_generic")
}

export function teamDateLabel(iso: string | null | undefined, locale: string): string {
  if (!iso) return ""
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return ""
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(parsed)
  } catch {
    return parsed.toISOString().slice(0, 10)
  }
}
