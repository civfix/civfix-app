export const INVITE_MAX_ROWS = 3

export interface InviteRowSlice<E, O> {
  events: readonly E[]
  orgs: readonly O[]
  total: number
}

export function inviteRowSlice<E, O>(
  eventInvites: readonly E[],
  orgInvites: readonly O[],
  max: number = INVITE_MAX_ROWS,
): InviteRowSlice<E, O> {
  const cap = Math.max(0, max)
  const events = eventInvites.slice(0, cap)
  return {
    events,
    orgs: orgInvites.slice(0, Math.max(0, cap - events.length)),
    total: eventInvites.length + orgInvites.length,
  }
}
