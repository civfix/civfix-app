import { describe, it, expect } from "vitest"
import {
  SocialLinksSchema,
  socialLinkUrl,
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
} from "../src/schemas/entities.js"
import { UpdateProfileRequestSchema, UserProfileDTOSchema } from "../src/schemas/social.js"

describe("SocialLinksSchema", () => {
  it("accepts bare handles + an E.164 whatsapp number", () => {
    const parsed = SocialLinksSchema.parse({
      facebook: "jane.doe",
      instagram: "jane_doe",
      tiktok: "janedoe",
      x: "jane",
      whatsapp: "14155552671",
    })
    expect(parsed.instagram).toBe("jane_doe")
    expect(parsed.whatsapp).toBe("14155552671")
  })

  it("allows null/omitted per platform (clearing) and an empty object", () => {
    expect(SocialLinksSchema.parse({ facebook: null })).toEqual({ facebook: null })
    expect(SocialLinksSchema.parse({})).toEqual({})
  })

  it("rejects full URLs, @-prefixes, and injection schemes (no open-redirect/XSS surface)", () => {
    expect(SocialLinksSchema.safeParse({ instagram: "https://instagram.com/x" }).success).toBe(false)
    expect(SocialLinksSchema.safeParse({ instagram: "@jane" }).success).toBe(false)
    expect(SocialLinksSchema.safeParse({ instagram: "javascript:alert(1)" }).success).toBe(false)
    expect(SocialLinksSchema.safeParse({ x: "a b" }).success).toBe(false)
    expect(SocialLinksSchema.safeParse({ instagram: "x".repeat(31) }).success).toBe(false)
  })

  it("rejects malformed whatsapp numbers", () => {
    expect(SocialLinksSchema.safeParse({ whatsapp: "+1 (415) 555-2671" }).success).toBe(false)
    expect(SocialLinksSchema.safeParse({ whatsapp: "0123" }).success).toBe(false)
    expect(SocialLinksSchema.safeParse({ whatsapp: "abc" }).success).toBe(false)
  })

  it("rejects unknown platform keys (strict)", () => {
    expect(SocialLinksSchema.safeParse({ youtube: "x" }).success).toBe(false)
  })
})

describe("socialLinkUrl", () => {
  it("builds the canonical https link per platform from a fixed template", () => {
    expect(socialLinkUrl("facebook", "jane")).toBe("https://facebook.com/jane")
    expect(socialLinkUrl("instagram", "jane")).toBe("https://instagram.com/jane")
    expect(socialLinkUrl("tiktok", "jane")).toBe("https://www.tiktok.com/@jane")
    expect(socialLinkUrl("x", "jane")).toBe("https://x.com/jane")
    expect(socialLinkUrl("whatsapp", "14155552671")).toBe("https://wa.me/14155552671")
  })

  it("has a label for every platform", () => {
    for (const p of SOCIAL_PLATFORMS) {
      expect(SOCIAL_PLATFORM_LABELS[p]).toBeTruthy()
    }
  })
})

describe("profile schemas carry socialLinks", () => {
  it("UpdateProfileRequest accepts an optional socialLinks patch", () => {
    const ok = UpdateProfileRequestSchema.parse({
      handle: "janedoe",
      displayName: "Jane",
      socialLinks: { instagram: "jane" },
    })
    expect(ok.socialLinks?.instagram).toBe("jane")
    expect(UpdateProfileRequestSchema.parse({ handle: "janedoe", displayName: "Jane" }).socialLinks).toBeUndefined()
  })

  it("UserProfileDTO parses with and without socialLinks", () => {
    const base = {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Jane",
      avatar: ["#aaaaaa", "#bbbbbb"] as [string, string],
      followers: 0,
      following: 0,
      isFollowing: false,
      pastEvents: [],
      stats: { reports: 0, cleanups: 0 },
    }
    expect(UserProfileDTOSchema.parse(base).socialLinks).toBeUndefined()
    expect(
      UserProfileDTOSchema.parse({ ...base, socialLinks: { x: "jane" } }).socialLinks?.x,
    ).toBe("jane")
  })
})
