import { describe, it, expect } from "vitest"
import {
  avatarGradient,
  stableHash,
  resolveAvatarGradient,
  monogram,
  AVATAR_PALETTE,
} from "../src/avatar.js"
import { tokens } from "../src/tokens/design-tokens.js"

/**
 * The avatar gradient is the single source server + clients share, so these lock its determinism,
 * palette membership, distinctness, and (critically) that the palette is DERIVED from the brand tokens
 * rather than re-copied.
 */

const A = "11111111-1111-1111-1111-111111111111"
const B = "22222222-2222-2222-2222-222222222222"
const C = "33333333-3333-3333-3333-333333333333"

describe("AVATAR_PALETTE", () => {
  it("is derived from tokens.color.brand (bloom, moss, sun, sky, lilac), not re-copied literals", () => {
    expect(AVATAR_PALETTE).toEqual([
      tokens.color.brand.bloom,
      tokens.color.brand.moss,
      tokens.color.brand.sun,
      tokens.color.brand.sky,
      tokens.color.brand.lilac,
    ])
  })

  it("excludes the sunDark accent", () => {
    expect(AVATAR_PALETTE as readonly string[]).not.toContain(tokens.color.brand.sunDark)
  })
})

describe("stableHash", () => {
  it("is a pure unsigned 32-bit value, stable per input", () => {
    expect(stableHash("abc")).toBe(stableHash("abc"))
    expect(stableHash("abc")).toBeGreaterThanOrEqual(0)
    expect(stableHash("abc")).toBeLessThanOrEqual(0xffffffff)
    expect(stableHash("abc")).not.toBe(stableHash("abd"))
  })
})

describe("avatarGradient", () => {
  it("is deterministic: same seed yields the same pair across calls", () => {
    expect(avatarGradient(A)).toEqual(avatarGradient(A))
  })

  it("returns two colors, both members of the brand palette", () => {
    for (const seed of [A, B, C, "jane", "@bob", "", "x"]) {
      const [from, to] = avatarGradient(seed)
      expect(AVATAR_PALETTE).toContain(from)
      expect(AVATAR_PALETTE).toContain(to)
    }
  })

  it("picks two DISTINCT colors", () => {
    for (const seed of [A, B, C, "jane", "@bob", "alice", "z", "0", "seed-123"]) {
      const [from, to] = avatarGradient(seed)
      expect(from).not.toEqual(to)
    }
  })

  it("different seeds can yield different gradients (not a constant)", () => {
    const seen = new Set<string>()
    for (let i = 0; i < 50; i++) seen.add(avatarGradient(`user-${i}`).join(">"))
    expect(seen.size).toBeGreaterThan(5)
  })

  it("matches the canonical algorithm output for a fixed seed (locks byte-for-byte parity)", () => {
    // first = stableHash(A) % 5; second = (first + 1 + stableHash(A + ':2') % 4) % 5.
    const n = AVATAR_PALETTE.length
    const first = stableHash(A) % n
    const stride = 1 + (stableHash(`${A}:2`) % (n - 1))
    const second = (first + stride) % n
    expect(avatarGradient(A)).toEqual([AVATAR_PALETTE[first], AVATAR_PALETTE[second]])
  })
})

describe("resolveAvatarGradient", () => {
  it("returns the server-provided pair when present", () => {
    expect(resolveAvatarGradient(["#111111", "#222222"], A)).toEqual(["#111111", "#222222"])
  })

  it("computes the deterministic fallback from the seed when the avatar is null/undefined", () => {
    expect(resolveAvatarGradient(null, A)).toEqual(avatarGradient(A))
    expect(resolveAvatarGradient(undefined, B)).toEqual(avatarGradient(B))
  })
})

describe("monogram", () => {
  it("uppercases the first character and ignores a leading @", () => {
    expect(monogram("ada")).toBe("A")
    expect(monogram("  @ada ")).toBe("A")
    expect(monogram("")).toBe("?")
    expect(monogram("   ")).toBe("?")
  })

  // charAt(0) would return half a surrogate pair, which renders as the replacement box.
  it("takes a whole code point for astral-plane names", () => {
    expect(monogram("\u{1F335} Cactus Crew")).toBe("\u{1F335}")
    expect([...monogram("\u{20BB7}bc")]).toHaveLength(1)
  })
})
