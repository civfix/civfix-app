/**
 * The rules here are decisions, not formatting, which is why they live outside the component:
 *
 *   - `chatInfoRoomKinds`: WHICH room kinds get an info surface at all. A group room has its own,
 *     richer GroupInfoBody; a DM has no room to describe.
 *   - `canLeaveChat`: leaving is a REPORT-room affordance only. An event chat's membership IS the
 *     RSVP, so a "Leave chat" there would silently un-RSVP the viewer from the event itself; that is
 *     a materially different action and belongs on the event, not in a chat info sheet. Reports have
 *     a genuine chat-only join/leave (POST /reports/:id/chat/{join,leave}), so only they offer it,
 *     and only once the viewer has actually joined.
 *   - `chatMemberCount`: the count shown under the hero, with its fallback chain. A report room
 *     prefers the roster endpoint's authoritative `total` and falls back to the report detail's
 *     cached `chatMemberCount` so the hero is never blank while the roster is still in flight.
 */

/** Room kinds whose "details" surface is the chat-info surface built in MembersBody. */
const chatInfoRoomKinds = ["report", "cleanup"] as const
export type ChatInfoRoomKind = (typeof chatInfoRoomKinds)[number]

export function isChatInfoRoomKind(roomKind: string): roomKind is ChatInfoRoomKind {
  return (chatInfoRoomKinds as readonly string[]).includes(roomKind)
}

export function canLeaveChat(roomKind: string, chatJoined: boolean | undefined): boolean {
  return roomKind === "report" && chatJoined === true
}

/**
 * The member count for the hero line. `rosterTotal` (the endpoint's true total, which may exceed the
 * capped array it ships alongside) wins; the entity's cached count is the pre-load fallback; 0 last
 * so the hero always renders a number rather than an empty line.
 */
export function chatMemberCount(
  rosterTotal: number | undefined,
  entityCount: number | undefined,
): number {
  return rosterTotal ?? entityCount ?? 0
}
