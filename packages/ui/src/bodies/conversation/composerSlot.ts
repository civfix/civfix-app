import type { RoomKind } from "@civfix/shared"
import type { ChannelComposerMode, GroupInfoGate } from "../channelComposerMode"

export type ComposerPlaceholder = "unavailable" | "group" | "dm"

export interface ComposerSlotSignals {
  roomKind: RoomKind
  channelMode: ChannelComposerMode
  hasGroupInfo: boolean
  groupInfoGate: GroupInfoGate
  hasRoomError: boolean
  showJoinBanner: boolean
  isReport: boolean
  isGroup: boolean
  pinnedOnly: boolean
  hasCityMention: boolean
}

export interface ComposerSlot {
  mode: ChannelComposerMode
  disabled: boolean
  canCreatePoll: boolean
  showForwardNotice: boolean
  placeholder: ComposerPlaceholder
}

export function resolveComposerSlot(signals: ComposerSlotSignals): ComposerSlot {
  // A group room keeps the normal composer until GET /groups/:id says whether it is a channel.
  const mode = signals.roomKind === "group" && !signals.hasGroupInfo ? "composer" : signals.channelMode
  const disabled = signals.hasRoomError || signals.showJoinBanner || signals.groupInfoGate !== "open"
  return {
    mode,
    disabled,
    canCreatePoll: signals.roomKind !== "dm" && mode === "composer",
    showForwardNotice:
      signals.isReport && mode === "composer" && !signals.pinnedOnly && !disabled && signals.hasCityMention,
    placeholder:
      signals.hasRoomError || signals.groupInfoGate === "blocked" ? "unavailable" : signals.isGroup ? "group" : "dm",
  }
}
