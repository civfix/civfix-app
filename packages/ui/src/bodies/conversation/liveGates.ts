import type { ChannelComposerMode } from "../channelComposerMode"

export interface LiveGateSignals {
  liveDisabled: boolean
  composerDisabled: boolean
  composerSlotMode: ChannelComposerMode
  pinnedOnly: boolean
}

export function canReactIn(s: LiveGateSignals): boolean {
  return !s.liveDisabled && !s.pinnedOnly
}

export function canVoteIn(s: LiveGateSignals): boolean {
  return !s.liveDisabled && !s.pinnedOnly
}

export function canReplyIn(s: LiveGateSignals): boolean {
  return canReactIn(s) && !s.composerDisabled && s.composerSlotMode === "composer"
}
