import type {
  CleanupMemberRole,
  HostCapability,
  OrganizationMemberRole,
} from "../schemas/common.js"

export interface HostStanding {
  eventRole: CleanupMemberRole | null
  orgRole: OrganizationMemberRole | null
}

const ORGANIZER_CAPABILITIES: readonly HostCapability[] = [
  "view_event_private",
  "view_roster",
  "view_guest_contact",
  "view_answers",
  "view_analytics",
  "check_in",
  "manage_event",
  "manage_tickets",
  "manage_team",
  "broadcast",
  "export",
  "manage_page",
  "cancel_event",
  "manage_org_link",
  "moderate_chat",
  "request_resources",
]

const COHOST_ONLY_TO_ORGANIZER: readonly HostCapability[] = [
  "manage_team",
  "cancel_event",
  "manage_org_link",
  "request_resources",
]

const COHOST_CAPABILITIES: readonly HostCapability[] = ORGANIZER_CAPABILITIES.filter(
  (cap) => !COHOST_ONLY_TO_ORGANIZER.includes(cap),
)

const COORDINATOR_ONLY_TO_COHOST: readonly HostCapability[] = [
  "view_guest_contact",
  "manage_event",
  "manage_tickets",
  "manage_page",
  "export",
]

const COORDINATOR_CAPABILITIES: readonly HostCapability[] = COHOST_CAPABILITIES.filter(
  (cap) => !COORDINATOR_ONLY_TO_COHOST.includes(cap),
)

const STAFF_CAPABILITIES: readonly HostCapability[] = ["view_event_private", "view_roster", "check_in"]

const ORG_OWNER_CAPABILITIES: readonly HostCapability[] = [
  ...ORGANIZER_CAPABILITIES,
  "manage_payments",
  "view_donations",
  "manage_org_members",
]

const ORG_ADMIN_CAPABILITIES: readonly HostCapability[] = [
  ...COHOST_CAPABILITIES.filter((cap) => cap !== "export"),
  "view_donations",
  "manage_org_members",
]

const EVENT_ROLE_CAPABILITIES: Readonly<Record<CleanupMemberRole, readonly HostCapability[]>> = {
  organizer: ORGANIZER_CAPABILITIES,
  cohost: COHOST_CAPABILITIES,
  coordinator: COORDINATOR_CAPABILITIES,
  staff: STAFF_CAPABILITIES,
  member: [],
}

const ORG_ROLE_CAPABILITIES: Readonly<Record<OrganizationMemberRole, readonly HostCapability[]>> = {
  owner: ORG_OWNER_CAPABILITIES,
  admin: ORG_ADMIN_CAPABILITIES,
  member: [],
}

const NONE = "none"

function standingKey(standing: HostStanding): string {
  return `${standing.eventRole ?? NONE}|${standing.orgRole ?? NONE}`
}

function immutableSet(values: Iterable<HostCapability>): ReadonlySet<HostCapability> {
  const set = new Set(values)
  const refuse = (): never => {
    throw new TypeError("hostCapabilities returns an immutable, shared capability set")
  }
  set.add = refuse as never
  set.delete = refuse as never
  set.clear = refuse as never
  return Object.freeze(set)
}

function buildTable(): ReadonlyMap<string, ReadonlySet<HostCapability>> {
  const eventRoles: (CleanupMemberRole | null)[] = [
    null,
    ...(Object.keys(EVENT_ROLE_CAPABILITIES) as CleanupMemberRole[]),
  ]
  const orgRoles: (OrganizationMemberRole | null)[] = [
    null,
    ...(Object.keys(ORG_ROLE_CAPABILITIES) as OrganizationMemberRole[]),
  ]
  const table = new Map<string, ReadonlySet<HostCapability>>()
  for (const eventRole of eventRoles) {
    for (const orgRole of orgRoles) {
      const merged: HostCapability[] = [
        ...(eventRole ? EVENT_ROLE_CAPABILITIES[eventRole] : []),
        ...(orgRole ? ORG_ROLE_CAPABILITIES[orgRole] : []),
      ]
      table.set(standingKey({ eventRole, orgRole }), immutableSet(merged))
    }
  }
  return table
}

const CAPABILITY_TABLE = buildTable()

const EMPTY_CAPABILITIES = immutableSet([])

export function hostCapabilities(standing: HostStanding): ReadonlySet<HostCapability> {
  return CAPABILITY_TABLE.get(standingKey(standing)) ?? EMPTY_CAPABILITIES
}

export function can(standing: HostStanding, capability: HostCapability): boolean {
  return hostCapabilities(standing).has(capability)
}

export const NO_HOST_STANDING: HostStanding = Object.freeze({ eventRole: null, orgRole: null })
