/**
 * The pure update fold for `useChat`'s detached around-mode window (jump-to-message).
 *
 * While an around window is active, live `message` frames keep buffering into liveMessages (the merged
 * list resumes when the window clears), so the window itself never grows. It tracks only
 * `message_update` frames for messages ALREADY inside it (edits, tombstones, reaction refreshes), so a
 * jumped-to slice never shows a body the server has since retracted.
 *
 *   - A DTO whose id is in the window REPLACES that item's message; the row flags (mine/pending/failed)
 *     are kept because identity and authorship cannot change on an update.
 *   - A DTO whose id is not in the window is dropped; appending is the merged live list's job, after
 *     clearAround.
 *   - When nothing matched, the SAME array reference comes back so a functional setState skips the
 *     re-render.
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
    if (idx === -1) continue
    if (!copied) {
      next = next.slice()
      copied = true
    }
    const prior = next[idx]!
    next[idx] = { ...prior, message: dto }
  }
  return next
}
