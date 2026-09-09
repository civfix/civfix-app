/**
 * resolveChannelComposerMode (P5 Task 5.4) - the PURE selector for what a chat_group room's composer
 * slot shows, given the viewer's role and the group's kind/visibility. RN-free so it unit-tests
 * directly under vitest (like chatPowers / groupWizard).
 *
 * Channels are broadcast rooms: only owner/admins post. So:
 *   - "composer"  - the normal message composer. Regular (non-channel) groups for any member; a
 *                   channel's owner/admins.
 *   - "mute-pill" - a channel SUBSCRIBER (role "member"): read-only, so the composer is replaced by a
 *                   Mute/Unmute pill.
 *   - "join-pill" - a signed-in NON-member of a PUBLIC channel: a Join pill (private channels a
 *                   non-member can't see resolve to "none").
 *   - "none"      - loading (kind not yet known) or any other case (e.g. a private channel non-member):
 *                   no composer, no pill.
 *
 * Only chat_group rooms (roomKind "group") are channels; dm/report/cleanup rooms are never channels,
 * so pass isGroupRoom=false for them and they always resolve to "composer".
 */
export type ChannelComposerMode = "composer" | "mute-pill" | "join-pill" | "none"

export interface ChannelComposerSignals {
  /** The room is a chat_group room (roomKind === "group"). */
  isGroupRoom: boolean
  /** The group's kind, once GET /groups/:id has loaded (undefined while loading). */
  groupKind?: "group" | "channel"
  /** The viewer's role in the group (null/undefined = not a member). */
  myRole?: "owner" | "admin" | "member" | null
  /** The group's visibility, once loaded (gates the public-channel Join pill). */
  visibility?: "private" | "public"
}

export function resolveChannelComposerMode(signals: ChannelComposerSignals): ChannelComposerMode {
  const { isGroupRoom, groupKind, myRole, visibility } = signals
  // dm/report/cleanup rooms keep the normal composer (they are never channels).
  if (!isGroupRoom) return "composer"
  // A regular chat group: any member composes.
  if (groupKind === "group") return "composer"
  if (groupKind === "channel") {
    // Owner/admins broadcast; a subscriber is read-only (Mute pill); a signed-in non-member of a
    // PUBLIC channel gets the Join pill. Anything else (private non-member) has no affordance.
    if (myRole === "owner" || myRole === "admin") return "composer"
    if (myRole === "member") return "mute-pill"
    if ((myRole === null || myRole === undefined) && visibility === "public") return "join-pill"
    return "none"
  }
  // Kind not yet loaded (or unknown): no affordance. The conversation body keeps the normal composer
  // until GET /groups/:id resolves, so this "none" never flashes for a regular group.
  return "none"
}

/**
 * Whether the composer must PAUSE because the room's channel-ness is still unknown, and why.
 *
 *   - "open"    - post away: not a group room, the group DTO is loaded, or the inbox already proved the
 *                 room is a regular (non-channel) group.
 *   - "loading" - GET /groups/:id is in flight. Silent pause (the slot still holds the normal composer,
 *                 so a regular group never flashes) - a beat, not an error.
 *   - "blocked" - the fetch FAILED and nothing else can rule out a channel, so a read-only subscriber
 *                 could otherwise be handed a live composer. Say so in the placeholder; don't dead-input.
 *
 * The `cachedChannel` signal is what keeps a transient 5xx from muting every REGULAR group: the /threads
 * inbox row flags channels (`channel: true`, omitted for ordinary groups), so a room the inbox already
 * lists as a non-channel group needs no /groups/:id at all to know its members may post - which is
 * exactly what the pre-P5 composer assumed for every group, and the server re-checks every send anyway.
 * Undefined means the inbox has no row yet (cold deep-link / fresh create): still uncertain, still held.
 */
export type GroupInfoGate = "open" | "loading" | "blocked"

export interface GroupInfoGateSignals {
  /** The room is a chat_group room (roomKind === "group"). */
  isGroupRoom: boolean
  /** GET /groups/:id has landed. */
  hasGroupInfo: boolean
  /** GET /groups/:id is in flight with nothing cached. */
  isLoading: boolean
  /** GET /groups/:id failed (react-query has exhausted its retries). */
  isError: boolean
  /**
   * What the /threads inbox row says: false = a cached row that is NOT a channel (regular group proof),
   * true = a cached channel, undefined = no cached row at all (nothing known).
   */
  cachedChannel?: boolean | undefined
}

export function resolveGroupInfoGate(signals: GroupInfoGateSignals): GroupInfoGate {
  const { isGroupRoom, hasGroupInfo, isLoading, isError, cachedChannel } = signals
  if (!isGroupRoom || hasGroupInfo) return "open"
  if (isError) return cachedChannel === false ? "open" : "blocked"
  if (isLoading) return "loading"
  return "open"
}
