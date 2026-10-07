/**
 * toggleReactionBucket: the single pure reaction-toggle reducer used by the chat hook (useChat).
 * Operates on a message's `ReactionSummaryDTO[]` summary so it patches a ChatMessageDTO's `reactions`.
 *
 * Optimistically flip one reaction bucket: if the viewer already reacted, decrement + clear `mine` (dropping
 * the bucket when it hits 0); otherwise increment + set `mine` (creating the bucket if absent). Pure.
 *
 * INTERNAL to the data seam (imported by relative path; NOT exported from the data barrel).
 */
import type { ReactionSummaryDTO } from "@civfix/shared"

export function toggleReactionBucket(reactions: ReactionSummaryDTO[], emoji: string): ReactionSummaryDTO[] {
  const existing = reactions.find((r) => r.emoji === emoji)
  if (!existing) return [...reactions, { emoji, count: 1, mine: true }]
  if (existing.mine) {
    const nextCount = existing.count - 1
    return nextCount <= 0
      ? reactions.filter((r) => r.emoji !== emoji)
      : reactions.map((r) => (r.emoji === emoji ? { ...r, count: nextCount, mine: false } : r))
  }
  return reactions.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r))
}
