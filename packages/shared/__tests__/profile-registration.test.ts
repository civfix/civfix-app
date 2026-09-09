import { describe, it, expect } from "vitest"

import { avatarColor, monogram, AVATAR_PALETTE } from "../src/avatar.js"
import { isValidHandle, HANDLE_REGEX } from "../src/schemas/social.js"

/**
 * Unit tests for the monogram-avatar + first-run-registration helpers shared across web/mobile/backend:
 * a deterministic solid color, the single monogram letter, and the username (handle) validator.
 */

describe("avatarColor", () => {
  it("is deterministic and drawn from the brand palette", () => {
    const a = avatarColor("user-123")
    expect(avatarColor("user-123")).toBe(a)
    expect(AVATAR_PALETTE).toContain(a)
  })

  it("varies across seeds (not all identical)", () => {
    const colors = new Set(["a", "b", "c", "d", "e", "f", "g"].map(avatarColor))
    expect(colors.size).toBeGreaterThan(1)
  })
})

describe("monogram", () => {
  it("returns the first letter, uppercased", () => {
    expect(monogram("rivera")).toBe("R")
    expect(monogram("Echo Park")).toBe("E")
  })

  it("ignores a leading @ and trims", () => {
    expect(monogram("  @jane")).toBe("J")
  })

  it("falls back to ? for empty input", () => {
    expect(monogram("   ")).toBe("?")
    expect(monogram("")).toBe("?")
  })
})

describe("isValidHandle", () => {
  it("accepts 3-20 chars of letters/digits/underscore", () => {
    expect(isValidHandle("ana_99")).toBe(true)
    expect(isValidHandle("ABC")).toBe(true)
    expect(isValidHandle("a".repeat(20))).toBe(true)
  })

  it("rejects too short, too long, spaces, and punctuation", () => {
    expect(isValidHandle("ab")).toBe(false)
    expect(isValidHandle("a".repeat(21))).toBe(false)
    expect(isValidHandle("has space")).toBe(false)
    expect(isValidHandle("dots.bad")).toBe(false)
    expect(isValidHandle("@handle")).toBe(false)
  })

  it("trims surrounding whitespace before validating", () => {
    expect(isValidHandle("  ana_99  ")).toBe(true)
  })

  it("exposes the regex used", () => {
    expect(HANDLE_REGEX.test("good_one")).toBe(true)
  })
})
