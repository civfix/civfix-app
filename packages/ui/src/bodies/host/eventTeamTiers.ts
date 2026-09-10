import type { CleanupMemberRole, EventTeamRole, HostCapability, SetMemberRoleRequest } from "@civfix/shared"
import { hostCapabilities } from "@civfix/shared/host"

export interface EventTeamTier {
  role: EventTeamRole
  labelKey: string
  hintKey: string
  capabilities: readonly HostCapability[]
}

export const INVITABLE_EVENT_TEAM_ROLES: readonly EventTeamRole[] = ["cohost", "coordinator", "staff"]

export type SettableEventMemberRole = SetMemberRoleRequest["role"]

export const SETTABLE_EVENT_MEMBER_ROLES: readonly SettableEventMemberRole[] = [
  "cohost",
  "coordinator",
  "staff",
  "member",
]

export function eventRoleLabelKey(role: CleanupMemberRole): string {
  return `enums:cleanupMemberRole.${role}`
}

export function eventRoleCapabilities(role: CleanupMemberRole): readonly HostCapability[] {
  return [...hostCapabilities({ eventRole: role, orgRole: null })]
}

export function eventTeamTiers(): readonly EventTeamTier[] {
  return INVITABLE_EVENT_TEAM_ROLES.map((role) => ({
    role,
    labelKey: eventRoleLabelKey(role),
    hintKey: `host-team:role.hint_${role}`,
    capabilities: eventRoleCapabilities(role),
  }))
}

export function settableRolesOtherThan(
  current: CleanupMemberRole | null | undefined,
): readonly SettableEventMemberRole[] {
  return SETTABLE_EVENT_MEMBER_ROLES.filter((role) => role !== current)
}
