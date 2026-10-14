/** The wire keeps the ASCII reaction names; only the on-screen display uses the emoji glyph. */
import { REACTION_EMOJIS, type ReactionEmoji, type ReactionSummaryDTO } from "@civfix/shared"

export const REACTION_GLYPH: Record<ReactionEmoji, string> = {
  like: "\u{1F44D}",
  heart: "\u{2764}\u{FE0F}",
  celebrate: "\u{1F389}",
  support: "\u{1F64F}",
  insightful: "\u{1F4A1}",
  concerned: "\u{1F61F}",
  laugh: "\u{1F602}",
  sad: "\u{1F622}",
}

export interface ReactionChipModel {
  emoji: ReactionEmoji
  glyph: string
  count: number
  mine: boolean
}

export function buildReactionChipModel(reactions: readonly ReactionSummaryDTO[]): ReactionChipModel[] {
  const byName = new Map(reactions.map((r) => [r.emoji, r]))
  const chips: ReactionChipModel[] = []
  for (const name of REACTION_EMOJIS) {
    const bucket = byName.get(name)
    if (!bucket || bucket.count <= 0) continue
    chips.push({ emoji: name, glyph: REACTION_GLYPH[name], count: bucket.count, mine: bucket.mine })
  }
  return chips
}
