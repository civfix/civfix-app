/**
 * applyUpdatesToWindow (P2 Task 2.7) - the PURE update fold for `useChat`'s detached around-mode
 * window (jump-to-message).
 *
 * While an around window is active, live inbound `message` frames keep buffering into liveMessages
 * as usual (the merged list resumes when the window clears) - the window itself does NOT grow. The
 * one thing the window must track live is `message_update` frames for messages ALREADY inside it
 * (edits, deletes/tombstones, reaction refreshes), so a jumped-to conversation slice never shows a
 * body the server has since retracted.
 *
 * Contract:
 *   - upsert-by-id for EXISTING window messages only: a fresh DTO whose id is present REPLACES that
 *     item's message wholesale (the row flags - mine/pending/failed - are untouched; identity and
 *     authorship cannot change on an update).
 *   - a DTO whose id is NOT in the window is DROPPED - new messages are never appended to a
 *     detached window (that is the merged live list's job, after clearAround).
 *   - referentially transparent no-op: when nothing matched, the SAME array reference comes back,
 *     so a functional setState skips the re-render.
 */
import type { ChatItem, ChatMessageDTO } from "@civfix/shared"

export function applyUpdatesToWindow(
  window: ChatItem[],
  updates: readonly ChatMessageDTO[],
): ChatItem[] {
  if (updates.length === 0) return window
  let next = window
  let copied = false
  for (const dto of updates) {
    const idx = next.findIndex((it) => it.message.id === dto.id)
    if (idx === -1) continue // not in the window: DROP (never append into a detached window)
    if (!copied) {
      next = next.slice()
      copied = true
    }
    const prior = next[idx]!
    next[idx] = { ...prior, message: dto }
  }
  return next
}
