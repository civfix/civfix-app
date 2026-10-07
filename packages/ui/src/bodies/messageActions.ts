/**
 * The action-assembly matrix for one chat message's context menu. The Bubble maps the returned key descriptors to full ContextMenuAction rows (translated label,
 * lucide icon, onPress); this module owns only the WHO-SEES-WHAT logic so it unit-tests without React
 * (package convention: pure-logic vitest).
 *
 * The permission semantics:
 *   - reply:  FIRST in the order (Telegram order) - any delivered non-system message (own or others'),
 *             gated on `canReply` (the caller's "viewer can send in this room" signal - room errors and
 *             the report-chat join gate turn it off) and on a server id (the reply reference must point
 *             at a persisted message).
 *   - copy:   any message with a non-empty body, but ONLY when the host registered a clipboard
 *             capability (omitted otherwise - a copy row that can't copy is worse than none).
 *   - edit:   own messages the caller already deemed editable (mine + kind text + 48h window - the
 *             caller's `canEdit` carries that policy, this module does not re-derive it).
 *   - pin/unpin: any delivered non-system message with a server id, when the caller's
 *             `canPin` says the viewer holds the room's pin power (see chatPowers.canPinIn - the
 *             server matrix stays authoritative). `isPinned` picks which of the two keys renders.
 *             Placed after reply/copy/edit and before delete.
 *   - delete: own messages the caller deemed deletable (destructive; the WIRING keeps the existing
 *             confirm step - this module only lists the entry point). ALSO offered on OTHERS'
 *             messages when `canDeleteOthers` (moderator delete - cleanup organizer / report
 *             operator, see chatPowers.canDeleteOthersIn); same confirm flow, server re-checks.
 *   - report: others' delivered messages (needs a server id to report).
 *   - block:  others' messages in GROUP rooms only (the Bubble only receives an onBlock handler in group
 *             rooms), and only when the author is a live, non-deleted account.
 *
 * System rows are Copy-only by spec (belt-and-braces: ConversationBody routes kind==="system" to
 * SystemMessageRow, which has no menu, so the wiring never actually hits this branch).
 * Pending/failed/tombstoned messages get NO actions - the menu never opens for them.
 *
 * Polls: a poll message (kind "poll") swaps the text-only rows (no copy - a poll has no
 * copyable body; no edit - polls are not text) for two poll-specific rows, while reply / pin / delete /
 * report / block keep their normal gates:
 *   - retractVote: the viewer has cast a vote (`myVote` non-empty) and the poll is still OPEN - lets them
 *                  un-vote (votePoll([])). Own or others' poll; hidden once closed or if never voted.
 *   - stopPoll:    the poll AUTHOR (mine) OR a room moderator (`canModeratePoll` - reuse of the
 *                  pin/delete-others power per room; report rooms: operator only) may close an OPEN poll.
 *   Copy/edit never appear on a poll; delete still follows the normal own/moderator delete gate.
 */

import type { PersonDTO } from "@civfix/shared"

export type MessageActionKey =
  | "reply"
  | "copy"
  | "edit"
  | "pin"
  | "unpin"
  | "jump"
  | "delete"
  | "report"
  | "block"
  | "retractVote"
  | "stopPoll"

export interface MessageActionDescriptor {
  key: MessageActionKey
  /** Paint the row in the danger color (delete / block). */
  destructive: boolean
}

export interface MessageActionsInput {
  /** The viewer authored this message. */
  mine: boolean
  /** kind === "system" (Copy-only rows; normally routed to SystemMessageRow before reaching a Bubble). */
  isSystem: boolean
  /** The room is a group room (group/cleanup/report); gates block. */
  isGroupRoom: boolean
  /** Optimistic sends in flight or failed: no menu at all. */
  pendingOrFailed: boolean
  /** Tombstoned (deletedAt set): no menu at all. */
  deleted: boolean
  /** The message has a server id (reportable). */
  hasMessageId: boolean
  /** The message has a non-empty text body (copyable). */
  hasBody: boolean
  /** The host registered a clipboard capability; without it the copy row is omitted entirely. */
  hasClipboard: boolean
  /** Caller-derived edit permission (mine + kind text + edit window). */
  canEdit: boolean
  /** Caller-derived delete permission (own messages). */
  canDelete: boolean
  /** The viewer holds this room's pin power (chatPowers.canPinIn; server stays authoritative). */
  canPin: boolean
  /** The message is currently pinned (truthy pinnedAt) - renders 'unpin' instead of 'pin'. */
  isPinned: boolean
  /** Moderator delete on OTHERS' messages (chatPowers.canDeleteOthersIn; server re-checks). */
  canDeleteOthers: boolean
  /** The author exists, has an id, and is not a deleted account (block target validity). */
  authorBlockable: boolean
  /** The viewer can send in this room (no room error / report-chat join gate) - gates reply. */
  canReply: boolean
  /** This message is a poll (kind === "poll") - swaps copy/edit for the poll rows below. */
  isPoll?: boolean
  /** The poll is closed (final results) - hides retractVote AND stopPoll (nothing left to do). */
  pollClosed?: boolean
  /** The viewer has cast a vote on this poll (myVote non-empty) - gates retractVote. */
  hasVoted?: boolean
  /** The viewer may close others' polls here (room moderator: pin/delete-others power) - gates stopPoll. */
  canModeratePoll?: boolean
  /**
   * The row renders inside the PINNED-MESSAGES view: the matrix collapses to the
   * reduced set jump ("Go to message", needs a server id) / copy / unpin (rights-gated via canPin;
   * every row there is pinned, so `isPinned` is not re-checked). Reply/edit/delete/report/block
   * never render there - those belong to the live thread the jump action leads back to.
   */
  pinnedOnlyView?: boolean
}

export function buildMessageActions(input: MessageActionsInput): MessageActionDescriptor[] {
  if (input.deleted || input.pendingOrFailed) return []

  if (input.pinnedOnlyView) {
    const reduced: MessageActionDescriptor[] = []
    if (!input.isSystem && input.hasMessageId) reduced.push({ key: "jump", destructive: false })
    if (input.hasBody && input.hasClipboard) reduced.push({ key: "copy", destructive: false })
    if (!input.isSystem && input.canPin && input.hasMessageId) reduced.push({ key: "unpin", destructive: false })
    return reduced
  }

  const actions: MessageActionDescriptor[] = []
  if (!input.isSystem && input.canReply && input.hasMessageId) actions.push({ key: "reply", destructive: false })
  if (!input.isPoll && input.hasBody && input.hasClipboard) actions.push({ key: "copy", destructive: false })
  if (input.isSystem) return actions

  // Both poll rows need a server id: they call the poll endpoints.
  if (input.isPoll && input.hasMessageId && !input.pollClosed) {
    if (input.hasVoted) actions.push({ key: "retractVote", destructive: false })
    if (input.mine || input.canModeratePoll) actions.push({ key: "stopPoll", destructive: false })
  }

  const pinRow: MessageActionDescriptor | null =
    input.canPin && input.hasMessageId
      ? { key: input.isPinned ? "unpin" : "pin", destructive: false }
      : null

  if (input.mine) {
    // canEdit is already false for a poll; the explicit guard keeps the text-only intent readable.
    if (!input.isPoll && input.canEdit) actions.push({ key: "edit", destructive: false })
    if (pinRow) actions.push(pinRow)
    if (input.canDelete) actions.push({ key: "delete", destructive: true })
  } else {
    if (pinRow) actions.push(pinRow)
    // Moderator delete: the wiring routes it through the SAME confirm popover as own-message delete.
    if (input.canDeleteOthers) actions.push({ key: "delete", destructive: true })
    if (input.hasMessageId) actions.push({ key: "report", destructive: false })
    if (input.isGroupRoom && input.authorBlockable) actions.push({ key: "block", destructive: true })
  }
  return actions
}

export function isBlockableAuthor(
  author: Pick<PersonDTO, "id" | "deleted" | "official"> | null | undefined,
): boolean {
  return Boolean(author && author.id && !author.deleted && !author.official)
}
