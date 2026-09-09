/**
 * Pure chip-model builder for the in-bubble reaction chips (P1 Task 1.3). Maps a message's
 * `ReactionSummaryDTO[]` onto the ordered list of chips `ReactionChips` renders: zero-count buckets and
 * unknown names are dropped, and the output ALWAYS follows the canonical `REACTION_EMOJIS` order no
 * matter what order the wire delivered. Kept renderer-free so it unit-tests without React (package
 * convention: pure-logic vitest).
 *
 * Also home of REACTION_GLYPH - the reaction NAME -> native Unicode emoji GLYPH map (moved here from
 * the retired ReactionBar). The wire/toggle contract stays the ASCII names (like/heart/...); only the
 * on-screen display is the color emoji.
 */
import { REACTION_EMOJIS, type ReactionEmoji, type ReactionSummaryDTO } from "@civfix/shared"

/**
 * The eight reaction NAMES -> a native Unicode emoji GLYPH each (authored as \u escapes so the source
 * stays ASCII):
 *   - like       -> U+1F44D            thumbs up
 *   - heart      -> U+2764 U+FE0F      red heart (with the emoji-presentation selector)
 *   - celebrate  -> U+1F389            party popper
 *   - support    -> U+1F64F            folded hands
 *   - insightful -> U+1F4A1            light bulb
 *   - concerned  -> U+1F61F            worried face
 *   - laugh      -> U+1F602            face with tears of joy
 *   - sad        -> U+1F622            crying face
 */
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

/** One rendered chip: a known reaction with a positive count, plus the viewer's own-reaction flag. */
export interface ReactionChipModel {
  emoji: ReactionEmoji
  glyph: string
  count: number
  mine: boolean
}

/**
 * Build the chips for one message. Canonical `REACTION_EMOJIS` order; buckets with `count <= 0` or an
 * unrecognized `emoji` name are dropped (defensive against wire drift).
 */
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
