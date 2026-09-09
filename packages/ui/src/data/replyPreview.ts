/**
 * buildLocalReplyTo (P2 Task 2.6) - the PURE optimistic reply-preview builder for `useChat.send`.
 *
 * When a reply is sent, the quoted message's full DTO is already in memory (history cache or the live
 * buffer), so the optimistic outbox message can carry a locally-built `replyTo` preview and the quote
 * strip paints immediately - no round trip. The server echo replaces the whole message on ack, bringing
 * the authoritative (backend-built) `replyTo` with it.
 *
 * Mirrors the backend's denormalization shape: `from` collapses to `{ id, displayName }` (PersonDTO.name
 * is the display name on the wire), the excerpt is the first REPLY_EXCERPT_MAX chars of the body (empty
 * string for attachment-only messages - the renderer substitutes a media descriptor), and `deleted` is
 * always false - you can only reply to a message that exists right now.
 */
import type { ChatMessageDTO, ReplyToDTO } from "@civfix/shared"

/** Excerpt cap, matching the backend's denormalized reply preview. */
export const REPLY_EXCERPT_MAX = 120

/** Build the optimistic ReplyToDTO for a reply to `message` (the quoted message's in-memory DTO). */
export function buildLocalReplyTo(message: ChatMessageDTO): ReplyToDTO {
  return {
    id: message.id,
    from: message.from ? { id: message.from.id, displayName: message.from.name } : null,
    // Code-point slice (Array.from iterates by code point), so the cap never splits a surrogate
    // pair - a plain String.slice at 120 UTF-16 units could end the excerpt on a lone surrogate.
    excerpt: Array.from(message.body ?? "").slice(0, REPLY_EXCERPT_MAX).join(""),
    kind: message.kind,
    deleted: false,
  }
}
