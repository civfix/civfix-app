import type { CleanupAttendeesResponse } from "@civfix/shared"

export type ChatInfoRosterAccess = "full" | "followed-only"

export interface ChatInfoRosterView {
  access: ChatInfoRosterAccess
  shown: number
  going: number
  showRestrictedNotice: boolean
  canMute: boolean
}

export interface ChatInfoRosterInput {
  roomKind: string
  scope: CleanupAttendeesResponse["scope"] | undefined
  going: number
  shown: number
  participant: boolean | undefined
}

export function chatInfoRosterView(input: ChatInfoRosterInput): ChatInfoRosterView {
  const followedOnly =
    input.roomKind === "cleanup" && input.scope === "following" && input.going > input.shown
  const access: ChatInfoRosterAccess = followedOnly ? "followed-only" : "full"
  return {
    access,
    shown: input.shown,
    going: input.going,
    showRestrictedNotice: followedOnly && input.shown > 0,
    canMute: input.roomKind !== "cleanup" || input.participant === true,
  }
}
