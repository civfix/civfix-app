import { tokens } from "./tokens/design-tokens.js"

/**
 * Deterministic initials-avatar colors. The server computes `PersonDTO.avatar` / `UserProfileDTO.avatar`
 * with the same pure function the clients use for an optimistic or offline avatar, so both sides agree
 * by construction.
 *
 * The palette order is fixed (bloom, moss, sun, sky, lilac) and the hash must stay byte-identical to the
 * historic server output, so stored gradients do not shift.
 */

/**
 * The brand palette the avatar colors draw from, one hex per brand scale. `sunDark` is intentionally
 * excluded; it is an accent, not an avatar color.
 */
export const AVATAR_PALETTE = [
  tokens.color.brand.bloom,
  tokens.color.brand.moss,
  tokens.color.brand.sun,
  tokens.color.brand.sky,
  tokens.color.brand.lilac,
] as const

export type AvatarColor = (typeof AVATAR_PALETTE)[number]

/** A `[from, to]` gradient pair. Mirrors the `avatar` tuple on PersonDTO / UserProfileDTO. */
export type AvatarGradient = [AvatarColor, AvatarColor]

/** Deterministic FNV-1a-style 32-bit hash of a string, stable across runs and platforms. */
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
 * Pick two DISTINCT palette colors for `seed`, deterministically: the hash picks the first, and a
 * stride from a second hash round picks the second, matching PersonDTO.avatar / UserProfileDTO.avatar.
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
 * The server-provided `[from, to]` pair when present, otherwise the deterministic fallback from `seed`
 * (typically the entity id), so a null/absent DTO avatar renders what the server would have produced.
 */
export function resolveAvatarGradient(
  avatar: readonly [string, string] | null | undefined,
  seed: string,
): [string, string] {
  if (avatar && avatar.length === 2) return [avatar[0], avatar[1]]
  return avatarGradient(seed)
}

/**
 * A single deterministic solid color for a seed (user id / handle) from the avatar palette: the fill
 * behind a monogram initial when there is no photo.
 */
export function avatarColor(seed: string): AvatarColor {
  return AVATAR_PALETTE[stableHash(seed) % AVATAR_PALETTE.length]!
}

/**
 * The single uppercase monogram character for a display name or handle: the first CODE POINT (a
 * leading "@" is ignored), or "?" when empty. Punctuation and emoji are kept, so a name is never
 * re-mapped to a different letter than the one the user sees.
 *
 * Code points, not `charAt(0)`: for a name starting with an astral-plane character (an emoji or a
 * CJK-extension glyph) the first UTF-16 unit renders as a lone surrogate.
 */
export function monogram(value: string): string {
  const ch = [...value.trim().replace(/^@+/, "")][0] ?? ""
  return ch ? ch.toUpperCase() : "?"
}
