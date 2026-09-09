import type { ChatMessageDTO } from "@civfix/shared"

/**
 * mergePins (P3 Task 3.6) - the PURE merge behind `useChat`'s derived `pins` list.
 *
 * Inputs:
 *   - `initialPins`: the first history page's `pins` array (full DTOs, pinned_at DESC, cap 25) -
 *     the server-owned snapshot at load time. patchMessage keeps these copies fresh for LOCAL
 *     optimistic pin/unpin (it patches the cached `pins` arrays alongside `items`), but a REMOTE
 *     flip arrives as a message_update frame, which only upserts into liveMessages.
 *   - `liveMessages`: every loaded message copy that may carry a fresher `pinnedAt` - the caller
 *     passes the flattened history items followed by the live buffer, so LATER entries win the
 *     dedupe (the live/WS copy supersedes the history copy, which supersedes the initial pin).
 *
 * Semantics:
 *   - Dedupe by id; the last-seen copy wins (see ordering contract above).
 *   - Only messages with a truthy `pinnedAt` survive - an unpin that arrived as an update (its
 *     copy has pinnedAt null) REMOVES the message from the result even if the initial pins array
 *     still lists it.
 *   - Tombstones are excluded too: soft-delete does NOT clear pinned_at server-side, and the
 *     server's pin list already skips deleted messages - so a local delete patch or a
 *     message_update tombstone must drop the pin here as well (no ghost "Photo" excerpt).
 *   - Sorted pinnedAt DESC (newest pin first), id ASC tie-break for a stable order.
 *
 * Known limitation (deliberate, matches existing frame semantics): a REMOTE pin of a message not
 * loaded anywhere client-side arrives as a message_update frame whose DTO lands in liveMessages,
 * so it DOES surface - but only while this room's hook is mounted; if the frame was missed
 * (socket down / other screen), the pin appears on the next initial-page reload.
 */
export function mergePins(
  initialPins: readonly ChatMessageDTO[],
  liveMessages: readonly ChatMessageDTO[],
): ChatMessageDTO[] {
  const byId = new Map<string, ChatMessageDTO>()
  for (const m of initialPins) byId.set(m.id, m)
  // Later copies win, but only copies of messages we can pin-track: a live message that was never
  // pinned and is not in the initial list simply carries pinnedAt undefined and is filtered below.
  for (const m of liveMessages) {
    const prior = byId.get(m.id)
    // A live/loaded copy REPLACES the initial pin (its pinnedAt is authoritative - message_update
    // frames carry the full DTO). A brand-new pinned message enters via its truthy pinnedAt.
    if (prior || m.pinnedAt != null) byId.set(m.id, m)
  }
  const pinned = [...byId.values()].filter((m) => m.pinnedAt != null && m.deletedAt == null)
  pinned.sort((a, b) => {
    const at = a.pinnedAt as string
    const bt = b.pinnedAt as string
    if (at !== bt) return at < bt ? 1 : -1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
  return pinned
}
