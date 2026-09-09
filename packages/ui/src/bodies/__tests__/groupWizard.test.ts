/**
 * Unit tests for the New-group wizard's pure step gating + draft normalization (P4 Task 4.7):
 * Next is disabled at 0 selected members; Create is disabled on a blank name; names/descriptions trim.
 */
import { describe, expect, it } from "vitest"
import {
  canProceedToIdentity,
  canCreateGroup,
  normalizeGroupDraft,
  GROUP_NAME_MAX,
  GROUP_DESCRIPTION_MAX,
} from "../groupWizard"

describe("canProceedToIdentity (step 1 Next gate)", () => {
  it("is disabled with no members selected", () => {
    expect(canProceedToIdentity(0)).toBe(false)
  })

  it("enables from one member up", () => {
    expect(canProceedToIdentity(1)).toBe(true)
    expect(canProceedToIdentity(50)).toBe(true)
  })
})

describe("canCreateGroup (step 2 Create gate)", () => {
  it("is disabled on an empty name", () => {
    expect(canCreateGroup("")).toBe(false)
  })

  it("is disabled on a whitespace-only name (the trimmed name is what counts)", () => {
    expect(canCreateGroup("   ")).toBe(false)
    expect(canCreateGroup("\n\t")).toBe(false)
  })

  it("enables on any non-blank name within the cap", () => {
    expect(canCreateGroup("Block cleanup crew")).toBe(true)
    expect(canCreateGroup("  padded  ")).toBe(true)
    expect(canCreateGroup("x".repeat(GROUP_NAME_MAX))).toBe(true)
  })

  it("is disabled when the trimmed name exceeds the 80-char contract cap", () => {
    expect(canCreateGroup("x".repeat(GROUP_NAME_MAX + 1))).toBe(false)
  })

  it("is disabled when the description exceeds the 500-char contract cap", () => {
    expect(canCreateGroup("ok", "d".repeat(GROUP_DESCRIPTION_MAX))).toBe(true)
    expect(canCreateGroup("ok", "d".repeat(GROUP_DESCRIPTION_MAX + 1))).toBe(false)
  })
})

describe("normalizeGroupDraft", () => {
  it("trims the name", () => {
    expect(normalizeGroupDraft("  Crew  ", "")).toEqual({ name: "Crew" })
  })

  it("trims the description and keeps it when non-blank", () => {
    expect(normalizeGroupDraft("Crew", "  weekly cleanups  ")).toEqual({
      name: "Crew",
      description: "weekly cleanups",
    })
  })

  it("OMITS the description key entirely when blank (never sends an empty string)", () => {
    const draft = normalizeGroupDraft("Crew", "   ")
    expect(draft).toEqual({ name: "Crew" })
    expect("description" in draft).toBe(false)
  })
})
