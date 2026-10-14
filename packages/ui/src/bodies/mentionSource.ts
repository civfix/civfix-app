/**
 * The per-room-kind decision for what the composer's @-mention typeahead may suggest. ConversationBody feeds the result straight into
 * MentionAutocomplete's `candidates` / `extraCandidates` props; this module owns only the
 * which-source-for-which-room logic so it unit-tests without React (package convention:
 * pure-logic vitest).
 *
 * The source matrix:
 *   - dm:      SCOPED to the single peer (only the person you are talking to is taggable), and only
 *              when they have a handle - a handleless peer yields an empty scoped set (no typeahead).
 *   - cleanup: SCOPED to the attendee roster, minus the viewer and anyone without a handle (you can
 *              only tag people actually in the room).
 *   - report:  UNSCOPED (`candidates: null`) - the GLOBAL mention search. Report-chat membership is
 *              enforced SERVER-side on resolve (a mention of a non-member resolves to nothing), so
 *              the client deliberately does NOT try to fetch/filter the member list. Report rooms
 *              ALSO get the report's routable jurisdiction as an extra candidate, suggested
 *              alongside users only when the city has a handle AND is reachable (canForwardToCity,
 *              which defaults to true when the DTO omits it). MentionAutocomplete lists extras
 *              FIRST and renders the jurisdiction row with a gov glyph.
 *   - group:   SCOPED to the member roster's FIRST PAGE (useGroupMembers), minus the viewer and the
 *              handleless, with a GLOBAL fallback (`candidates: null`) while the roster has not
 *              loaded yet - the server scopes mention RESOLUTION to chat_group_members either way,
 *              so an unscoped typeahead never lets a non-member mention actually land.
 *              Null/loaded distinction: `groupMembers` null/undefined = not loaded -> global;
 *              a LOADED roster always yields a scoped array - in a solo group that array is []
 *              (the only member is the viewer, so nobody is taggable). No extra candidates.
 */
import type { RoomKind, UserSearchResultDTO } from "@civfix/shared"
import type { JurisdictionMentionCandidate } from "../primitives/MentionAutocomplete"
import { normalizeHandle } from "./mentionText"

/** The minimal person shape the source needs (PersonDTO and the attendee rows both satisfy it). */
export interface MentionPersonInput {
  id: string
  name: string
  handle?: string | null
  avatar?: UserSearchResultDTO["avatar"]
  avatarUrl?: string | null
}

/** The minimal report-detail slice the source needs (ReportDTO satisfies it). */
export interface MentionReportInput {
  cityHandle?: string | null
  cityName?: string | null
  canForwardToCity?: boolean
}

export interface MentionSourceInput {
  roomKind: RoomKind
  /** The DM peer, when known (dm rooms only). */
  peer?: MentionPersonInput | null
  /** The cleanup attendee roster, when loaded (cleanup rooms only). */
  attendees?: readonly MentionPersonInput[] | null
  /**
   * The group member roster's first page, when loaded (group rooms only). null/undefined means
   * "not loaded yet" and falls back to the GLOBAL search (unlike cleanup, where unloaded = []).
   */
  groupMembers?: readonly MentionPersonInput[] | null
  /** The viewer's user id (excluded from the cleanup roster - you cannot tag yourself). */
  viewerId: string | null
  /** The report detail, when loaded (report rooms only - carries the routable jurisdiction). */
  report?: MentionReportInput | null
}

export interface MentionSource {
  /**
   * The fixed user candidate set for SCOPED rooms, or null for UNSCOPED (MentionAutocomplete then
   * uses the global `useMentionSearch`). Note the null/empty distinction: [] means "nobody is
   * taggable here", null means "anyone is (server-scoped)".
   */
  candidates: UserSearchResultDTO[] | null
  /** Non-user candidates listed first (the report's routable jurisdiction), or []. */
  extraCandidates: JurisdictionMentionCandidate[]
}

function toUserCandidate(p: MentionPersonInput): UserSearchResultDTO {
  return {
    id: p.id,
    handle: p.handle as string,
    displayName: p.name,
    avatar: p.avatar,
    avatarUrl: p.avatarUrl ?? null,
  }
}

export function resolveMentionSource(input: MentionSourceInput): MentionSource {
  const { roomKind, peer, attendees, groupMembers, viewerId, report } = input
  if (roomKind === "dm") {
    return {
      candidates: peer && peer.handle ? [toUserCandidate(peer)] : [],
      extraCandidates: [],
    }
  }
  if (roomKind === "report") {
    const bare = report?.cityHandle ? normalizeHandle(report.cityHandle) : ""
    const reachable = report?.canForwardToCity !== false
    return {
      candidates: null,
      extraCandidates:
        bare.length > 0 && reachable
          ? [
              {
                kind: "jurisdiction",
                id: bare,
                handle: bare,
                // Display name falls back to the bare handle (never a hardcoded English phrase).
                displayName: report?.cityName ?? bare,
              },
            ]
          : [],
    }
  }
  if (roomKind === "group") {
    return {
      candidates: groupMembers
        ? groupMembers.filter((m) => !!m.handle && m.id !== viewerId).map(toUserCandidate)
        : null,
      extraCandidates: [],
    }
  }
  return {
    candidates: (attendees ?? [])
      .filter((a) => !!a.handle && a.id !== viewerId)
      .map(toUserCandidate),
    extraCandidates: [],
  }
}
