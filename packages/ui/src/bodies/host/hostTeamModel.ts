import type {
  CleanupMemberRole,
  EventTeamInviteDTO,
  EventTeamInviteIdentifierKind,
  EventTeamMemberDTO,
} from "@civfix/shared"
import { MAX_TEAM_INVITES_PER_EVENT, isValidHandle } from "@civfix/shared"
import { GUEST_EMAIL_MAX, guestEmailValue } from "./registration/guestRsvpModel"
import { settableRolesOtherThan, type SettableEventMemberRole } from "../../data/eventTeamTiers"

export const TEAM_MEMBER_ROLE_ORDER: readonly CleanupMemberRole[] = [
  "organizer",
  "cohost",
  "coordinator",
  "staff",
  "member",
]

export const INVITE_IDENTIFIER_MAX = GUEST_EMAIL_MAX

export function teamMemberRank(role: CleanupMemberRole): number {
  const at = TEAM_MEMBER_ROLE_ORDER.indexOf(role)
  return at === -1 ? TEAM_MEMBER_ROLE_ORDER.length : at
}

export function orderedTeamMembers(
  members: readonly EventTeamMemberDTO[],
): EventTeamMemberDTO[] {
  return [...members].sort((a, b) => {
    const byRank = teamMemberRank(a.role) - teamMemberRank(b.role)
    if (byRank !== 0) return byRank
    return a.person.name.localeCompare(b.person.name)
  })
}

export interface TeamMemberActions {
  roles: readonly SettableEventMemberRole[]
  canRemove: boolean
}

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
  return actions.roles.length > 0 || actions.canRemove
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
  return invites.filter((invite) => invite.status === "pending").length
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

export function inviteErrorKey(code: string | undefined): string {
  if (code === "NOT_FOUND") return "invite.error_no_account"
  if (code === "CONFLICT") return "invite.error_conflict"
  if (code === "FORBIDDEN") return "invite.error_forbidden"
  if (code === "RATE_LIMITED") return "invite.error_rate_limited"
  if (code === "VALIDATION") return "invite.error_invalid"
  return "invite.error_generic"
}

export function teamManageErrorKey(code: string | undefined): string {
  if (code === "CONFLICT") return "manage.error_conflict"
  if (code === "FORBIDDEN") return "manage.error_forbidden"
  if (code === "NOT_FOUND") return "manage.error_gone"
  return "manage.error_generic"
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
