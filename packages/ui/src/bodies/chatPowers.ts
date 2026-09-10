/**
 * chatPowers (P3 Task 3.7) - the PURE per-room-kind moderation matrix for the chat UI: who may
 * pin/unpin messages, and who may delete OTHER people's messages. These flags only gate what the
 * context menu OFFERS - the server stays authoritative and re-checks every pin/unpin/delete
 * request (an out-of-date client showing a row it shouldn't just gets a 403).
 *
 * Mirror of the server matrix (P3 backend; group lane P4):
 *   pin/unpin:
 *     - dm:      either participant (rendering the room at all implies participation).
 *     - cleanup: whoever holds `moderate_chat` - organizer, co-host or coordinator.
 *     - report:  the report-chat OWNER (the report's creator, auto-joined as owner) OR an operator.
 *     - group:   the group's owner or an admin (the viewer's `myRole` off GET /groups/:id).
 *   delete others' messages:
 *     - dm:      never (each side deletes only their own).
 *     - cleanup: whoever holds `moderate_chat`.
 *     - report:  an OPERATOR only - the report owner does NOT get moderator delete.
 *     - group:   the group's owner or an admin (same lane as pin - group moderation is role-driven,
 *                platform operators get no implicit group power client-side).
 */
import type { RoomKind } from "@civfix/shared"

export interface ChatPowerSignals {
  roomKind: RoomKind
  /** The viewer is one of the DM thread's two participants. */
  isDmParticipant: boolean
  /** The viewer holds `moderate_chat` on this cleanup (capability set, legacy role fallback included). */
  canModerateCleanupChat: boolean
  /** The viewer created the report behind this report chat (report.mine - the creator joins as owner). */
  isReportChatOwner: boolean
  /** The viewer's account role is "operator" (session UserDTO.role). */
  isOperator: boolean
  /**
   * The viewer's role in a GROUP room (ChatGroupDTO.myRole off GET /groups/:id). Optional: only group
   * rooms carry it; null/undefined = not a member (or unknown yet - powers stay off until it loads).
   */
  myGroupRole?: "owner" | "admin" | "member" | null
}

/** Owner/admin of a group room - the single role gate both group powers share. */
function isGroupModerator(s: ChatPowerSignals): boolean {
  return s.myGroupRole === "owner" || s.myGroupRole === "admin"
}

/** May the viewer pin/unpin messages in this room? (Server-authoritative; UI gate only.) */
export function canPinIn(s: ChatPowerSignals): boolean {
  switch (s.roomKind) {
    case "dm":
      return s.isDmParticipant
    case "cleanup":
      return s.canModerateCleanupChat
    case "report":
      return s.isReportChatOwner || s.isOperator
    case "group":
      return isGroupModerator(s)
    default:
      return false
  }
}

/** May the viewer delete OTHERS' messages in this room? (Server-authoritative; UI gate only.) */
export function canDeleteOthersIn(s: ChatPowerSignals): boolean {
  switch (s.roomKind) {
    case "dm":
      return false
    case "cleanup":
      return s.canModerateCleanupChat
    case "report":
      // Deliberately NOT the report owner: only operators moderate report-chat messages.
      return s.isOperator
    case "group":
      return isGroupModerator(s)
    default:
      return false
  }
}
