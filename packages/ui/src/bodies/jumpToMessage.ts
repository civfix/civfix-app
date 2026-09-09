/**
 * resolveJump (P2 Task 2.7) - the PURE jump-to-message decision for ConversationBody's quoted-reply
 * taps: scroll to the target if it is already rendered, otherwise fetch an around-mode window.
 *
 * The helper takes the FlatList's ACTUAL render-row array - the inverted (already-reversed) rows,
 * day separators and typing row included - and matches by SERVER message id (`item.message.id`, the
 * id a ReplyToDTO carries), NOT the RenderItem key (which prefers clientId for the viewer's own
 * sends). Taking the render rows keeps the returned index honest: it is directly usable as
 * `scrollToIndex({ index })` on the inverted list, with no separate separator-offset bookkeeping to
 * drift out of sync.
 */
import type { RenderItem } from "./conversation/conversationModel"

export type JumpResolution = { type: "scroll"; index: number } | { type: "fetch" }

export function resolveJump(targetId: string, rows: readonly RenderItem[]): JumpResolution {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    if (row.type === "row" && row.item.message.id === targetId) return { type: "scroll", index: i }
  }
  return { type: "fetch" }
}
