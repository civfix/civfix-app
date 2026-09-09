import { tokens } from "./tokens/design-tokens.js"

/**
 * Deterministic initials-avatar gradient.
 *
 * This is the SINGLE SOURCE for the avatar gradient algorithm. The server computes
 * `PersonDTO.avatar` / `UserProfileDTO.avatar` with it and ships the `[from, to]` pair; the clients
 * render that pair (and can call this directly for an optimistic / offline / "me" sentinel avatar
 * before a server value exists). Because both sides derive from the same pure function and the same
 * brand palette, they are guaranteed to agree by construction.
 *
 * The palette is DERIVED from the shared design tokens (`tokens.color.brand`) rather than re-copied as
 * hex literals, so a brand-color change in the tokens flows through automatically and there is no
 * unguarded duplicate to drift. Order is fixed (bloom, moss, sun, sky, lilac) so the index math below
 * stays stable across releases.
 *
 * The algorithm is the canonical one that previously lived in the backend social service: an
 * FNV-1a-style 32-bit hash picks the first color, and a co-prime stride derived from a second hash
 * round picks a DISTINCT second color. It is moved verbatim so existing rendered gradients do not
 * shift.
 */

/**
 * The brand palette the avatar gradient draws from: one representative hex per brand scale
 * (bloom/moss/sun/sky/lilac), pulled from the shared tokens. `as const` keeps the exact literal types.
 * NOTE: `sunDark` is intentionally excluded; it is an accent, not an avatar color.
 */
export const AVATAR_PALETTE = [
  tokens.color.brand.bloom,
  tokens.color.brand.moss,
  tokens.color.brand.sun,
  tokens.color.brand.sky,
  tokens.color.brand.lilac,
] as const

export type AvatarColor = (typeof AVATAR_PALETTE)[number]

/**
 * A `[from, to]` gradient pair. Mirrors the `avatar` tuple on PersonDTO / UserProfileDTO.
 */
export type AvatarGradient = [AvatarColor, AvatarColor]

/**
 * Deterministic FNV-1a-style 32-bit hash of a string. Pure + stable across runs/platforms (no
 * Math.random, no Date). Used to pick the avatar gradient colors from a user id / handle.
 */
export function stableHash(seed: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    // 32-bit FNV prime multiply via shifts to stay in the unsigned 32-bit range.
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return h >>> 0
}

/**
 * Pick two DISTINCT colors from the brand palette for `seed`, deterministically. The first color is
 * the hash modulo the palette size; the second is offset by a co-prime stride (so it never collides
 * with the first across the 5-color palette) derived from a second hash round. Returns a `[from, to]`
 * hex pair that drives an initials-avatar gradient on the client, matching PersonDTO.avatar /
 * UserProfileDTO.avatar.
 *
 * Pure: same seed -> same pair, always.
 */
export function avatarGradient(seed: string): AvatarGradient {
  const n = AVATAR_PALETTE.length
  const h = stableHash(seed)
  const first = h % n
  // Stride in 1..n-1 so (first + stride) % n != first; with a 5-color (prime) palette any stride
  // works, but deriving it from a rehash spreads the second color rather than always being "next".
  const stride = 1 + (stableHash(`${seed}:2`) % (n - 1))
  const second = (first + stride) % n
  return [AVATAR_PALETTE[first]!, AVATAR_PALETTE[second]!]
}

/**
 * Resolve a DTO avatar to a concrete gradient: return the server-provided `[from, to]` pair when it is
 * present, otherwise compute the deterministic fallback from `seed` (typically the entity id). This is
 * the small helper clients use so a null/absent DTO avatar still renders the same gradient the server
 * would have produced.
 */
export function resolveAvatarGradient(
  avatar: readonly [string, string] | null | undefined,
  seed: string,
): [string, string] {
  if (avatar && avatar.length === 2) return [avatar[0], avatar[1]]
  return avatarGradient(seed)
}

/**
 * A SINGLE deterministic solid color for a seed (user id / handle), drawn from the same brand palette
 * as the gradient. This is what the monogram avatars fill with now that gradients are retired: clients
 * render `avatarColor(seed)` behind the first-letter initial (or a real photo when one exists).
 */
export function avatarColor(seed: string): AvatarColor {
  return AVATAR_PALETTE[stableHash(seed) % AVATAR_PALETTE.length]!
}

/**
 * The single uppercase monogram character for a display name or handle: the first CODE POINT (a
 * leading "@" is ignored), or "?" when empty. Per product, the monogram is the first character of the
 * username/name — punctuation and emoji included, so a name is never silently re-mapped to a different
 * letter than the one the user sees.
 *
 * Iterating code points (not `charAt(0)`, which yields a code UNIT) matters for any name starting with
 * an astral-plane character — an emoji or a CJK-extension glyph — where taking the first UTF-16 half
 * renders as a lone surrogate (the replacement box).
 */
export function monogram(value: string): string {
  const ch = [...value.trim().replace(/^@+/, "")][0] ?? ""
  return ch ? ch.toUpperCase() : "?"
}
