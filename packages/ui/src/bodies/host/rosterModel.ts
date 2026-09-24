export interface RosterMemberActions<Role> {
  roles: readonly Role[]
  canRemove: boolean
}

export function rankIn<Role>(order: readonly Role[], role: Role): number {
  const at = order.indexOf(role)
  return at === -1 ? order.length : at
}

export function orderByRankThenName<Role, Member extends { role: Role; person: { name: string } }>(
  order: readonly Role[],
  members: readonly Member[],
): Member[] {
  return [...members].sort((a, b) => {
    const byRank = rankIn(order, a.role) - rankIn(order, b.role)
    if (byRank !== 0) return byRank
    return a.person.name.localeCompare(b.person.name)
  })
}

export function pendingCount(invites: readonly { status: string }[]): number {
  return invites.filter((invite) => invite.status === "pending").length
}

export function hasActions(actions: RosterMemberActions<unknown>): boolean {
  return actions.roles.length > 0 || actions.canRemove
}

export function errorKeyFor(
  keys: ReadonlyMap<string, string>,
  code: string | undefined,
  fallback: string,
): string {
  return (code === undefined ? undefined : keys.get(code)) ?? fallback
}
