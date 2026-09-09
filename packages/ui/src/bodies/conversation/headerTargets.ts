/**
 * WHICH CONVERSATION-HEADER AFFORDANCES A HOST IS ALLOWED TO SHOW.
 *
 * THE RULE: the conversation header offers four drill-downs that are NOT the conversation itself - the
 * pinned-messages list, the member roster, the group-info surface and (report rooms) the report detail.
 * Each has a host override prop; with no override the body falls back to pushing the matching entry onto
 * the shared nav store. That fallback is only correct while the conversation IS a nav entry. So: a
 * fullScreen mount with NO host handler must show NO affordance at all.
 *
 * WHY, concretely. On mobile the conversation is an expo-router SCREEN (`/messages/[id]`) that
 * MobileNavAdapter bridges the `thread` entry out to, popping the entry. The nav store the body can still
 * reach belongs to the shell UNDERNEATH that screen, so a default `push` paints the pushed body on the
 * shell's page stack BEHIND the chat: the tap looks dead, and a stray entry is left on the hidden stack to
 * ambush the user after they back out. For the pinned list it is worse still - the pinned body mounts a
 * SECOND `useChat` for the same room, and either instance's unmount sends the socket's unconditional room
 * `leave`, silently freezing live chat for the survivor.
 *
 * A HIDDEN AFFORDANCE IS THE HONEST OUTCOME, not a degradation: a control that navigates nowhere is a lie,
 * and the fix for any given target is to give that host a real destination and pass the handler (which is
 * exactly what the mobile `/groups/[id]/info` and `/messages/members/[roomKind]/[id]` routes now do for
 * group-info and members). Same shape as `hostFormNavEscape` in composerCreateFlow.ts: the platform fact
 * ("can a shell-owned surface be drawn above me?") is stated once, in one pure place, instead of being
 * re-derived at each affordance.
 *
 * `pinnedList` is the original of the pattern (P3 Task 3.8) and keeps its exact previous semantics; the
 * other three are the same decision, made once each.
 */

export interface ConvoHeaderTargetInput {
  /** Is the conversation mounted as its OWN full screen, outside the shell's nav stack? */
  fullScreen: boolean
  /** Did the host pass an override for the pinned-messages list? */
  hasOpenPinnedList: boolean
  /** Did the host pass an override for the member roster? */
  hasOpenMembers: boolean
  /** Did the host pass an override for the group-info surface? */
  hasOpenGroupInfo: boolean
  /** Did the host pass an override for the report detail (report rooms only)? */
  hasViewReport: boolean
}

export interface ConvoHeaderTargets {
  /** Show the PinnedBar's "open the full list" button. */
  pinnedList: boolean
  /** Show the members-count sub-row as a pressable roster link. */
  members: boolean
  /** Let the group title/avatar open the group-info surface. */
  groupInfo: boolean
  /** Let a report room's title press + overflow row open the report detail. */
  viewReport: boolean
}

/**
 * One target's decision: a host handler always wins; without one the store fallback is only reachable
 * from an IN-SHELL mount. Exported on its own so a future fifth target reads as one call, not a new rule.
 */
export function convoHeaderTargetEnabled(input: { fullScreen: boolean; hasHostHandler: boolean }): boolean {
  return input.hasHostHandler || !input.fullScreen
}

/** All four header drill-downs resolved in one call, so the body holds no per-affordance policy. */
export function convoHeaderTargets(input: ConvoHeaderTargetInput): ConvoHeaderTargets {
  const { fullScreen } = input
  return {
    pinnedList: convoHeaderTargetEnabled({ fullScreen, hasHostHandler: input.hasOpenPinnedList }),
    members: convoHeaderTargetEnabled({ fullScreen, hasHostHandler: input.hasOpenMembers }),
    groupInfo: convoHeaderTargetEnabled({ fullScreen, hasHostHandler: input.hasOpenGroupInfo }),
    viewReport: convoHeaderTargetEnabled({ fullScreen, hasHostHandler: input.hasViewReport }),
  }
}
