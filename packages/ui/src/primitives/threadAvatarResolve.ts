/**
 * Pure mapping from a message thread to what its leading ThreadAvatar should render. Kept separate from
 * the (react-native) component so it can be unit-tested without a renderer, and so the avatar decision is
 * ONE source of truth.
 *
 * The goal is consistency with the rest of the app: a DM renders the peer's real backend/provider photo
 * (`peer.avatarUrl`) when set, otherwise the SAME deterministic solid brand color + single-letter monogram
 * that `Avatar` draws everywhere else (connections / feed / profile) - gradients are retired. A group /
 * cleanup / report chat keeps a Users glyph on that same solid color (seeded by the room id), never a photo.
 */
import { avatarColor, monogram, type MessageThreadDTO, type PersonDTO } from "@civfix/shared"

/** The peer fields the avatar needs - a subset of PersonDTO so a header pseudo-thread can supply a partial. */
export type ThreadAvatarPeer = Pick<PersonDTO, "id" | "name" | "avatarUrl" | "avatar">

/** Just enough of a thread to render its avatar (the full MessageThreadDTO is assignable to this). */
export type ThreadAvatarInput = Pick<MessageThreadDTO, "id" | "kind" | "title" | "refId"> & {
  peer?: ThreadAvatarPeer | null
}

export interface ResolvedThreadAvatar {
  /** A group / cleanup crew (renders the Users glyph) rather than a single person. */
  isGroup: boolean
  /** The real photo to show (DM peer only); null => render the monogram letter (DM) or glyph (group). */
  photoUrl: string | null
  /** Display name for the monogram letter (the peer's name, else the thread title). */
  name: string
  /** Seed for the deterministic solid fill color (the peer id, else the room id). Mirrors `Avatar.seed`. */
  seed: string
  /** The peer's server `[from,to]` avatar pair when present; its first stop is the solid fill (legacy). */
  gradient: readonly [string, string] | null
  /** The resolved solid fill color (server pair's first stop, else `avatarColor(seed)`). */
  color: string
  /** The single uppercase monogram letter for a photoless DM. */
  letter: string
}

export function resolveThreadAvatar(thread: ThreadAvatarInput): ResolvedThreadAvatar {
  const isGroup = thread.kind === "group" || thread.kind === "cleanup" || thread.kind === "report"
  // A group never shows a peer photo; ignore any peer attached to a non-DM thread.
  const peer = isGroup ? null : thread.peer ?? null
  const seed = peer?.id ?? thread.refId ?? thread.id
  const gradient = peer?.avatar ?? null
  const color = gradient?.[0] ?? avatarColor(seed)
  return {
    isGroup,
    photoUrl: peer?.avatarUrl ?? null,
    name: peer?.name ?? thread.title,
    seed,
    gradient,
    color,
    letter: monogram(peer?.name ?? thread.title),
  }
}
