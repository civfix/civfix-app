import { describe, expect, it } from "vitest"
import {
  canProceedFromChannelIdentity,
  isChannelVisibilityValid,
  canCreateChannel,
  CHANNEL_DEFAULT_VISIBILITY,
} from "../channelWizard"

describe("canProceedFromChannelIdentity (step 1 identity gate)", () => {
  it("is disabled on a blank / whitespace-only name", () => {
    expect(canProceedFromChannelIdentity("")).toBe(false)
    expect(canProceedFromChannelIdentity("   ")).toBe(false)
  })

  it("enables on any non-blank name within the cap", () => {
    expect(canProceedFromChannelIdentity("Neighborhood alerts")).toBe(true)
    expect(canProceedFromChannelIdentity("  padded  ")).toBe(true)
  })

  it("is disabled when the trimmed name exceeds the contract cap", () => {
    expect(canProceedFromChannelIdentity("x".repeat(81))).toBe(false)
  })
})

describe("isChannelVisibilityValid (step 2)", () => {
  it("is always valid for either enum member", () => {
    expect(isChannelVisibilityValid("private")).toBe(true)
    expect(isChannelVisibilityValid("public")).toBe(true)
  })

  it("accepts the default selection (the step can never block Next)", () => {
    expect(CHANNEL_DEFAULT_VISIBILITY).toBe("private")
    expect(isChannelVisibilityValid(CHANNEL_DEFAULT_VISIBILITY)).toBe(true)
  })
})

describe("canCreateChannel (step 3 Create gate)", () => {
  it("is allowed with a valid name regardless of member count (0 subscribers is fine)", () => {
    // The gate takes no member count at all - a channel with zero initial subscribers is valid.
    expect(canCreateChannel("Alerts")).toBe(true)
  })

  it("is disabled on a blank name", () => {
    expect(canCreateChannel("")).toBe(false)
    expect(canCreateChannel("  ")).toBe(false)
  })
})
