import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { SOCIAL_PLATFORMS, socialLinkUrl } from "@civfix/shared"
import { presentSocialPlatforms } from "../socialLinksModel"

const GLYPHS = readFileSync(new URL("../SocialGlyph.tsx", import.meta.url), "utf8")
const ORG_PAGE = readFileSync(new URL("../../bodies/host/OrgPageBody.tsx", import.meta.url), "utf8")

describe("presentSocialPlatforms", () => {
  it("keeps the bare handles the schema actually stores", () => {
    expect(presentSocialPlatforms({ instagram: "civfix", whatsapp: "13105551234" })).toEqual([
      { platform: "instagram", value: "civfix" },
      { platform: "whatsapp", value: "13105551234" },
    ])
  })

  it("drops a null, absent or blank value", () => {
    expect(presentSocialPlatforms({ instagram: null, x: "   " })).toEqual([])
    expect(presentSocialPlatforms(null)).toEqual([])
    expect(presentSocialPlatforms(undefined)).toEqual([])
  })

  it("orders by the contract's platform list, not by key insertion", () => {
    const order = presentSocialPlatforms({ x: "a", facebook: "b", instagram: "c" })
    expect(order.map((entry) => entry.platform)).toEqual(["facebook", "instagram", "x"])
  })

  it("trims a handle before it reaches socialLinkUrl", () => {
    const [entry] = presentSocialPlatforms({ tiktok: " civfix " })
    expect(entry && socialLinkUrl(entry.platform, entry.value)).toBe("https://www.tiktok.com/@civfix")
  })
})

describe("SocialGlyph", () => {
  it("draws every platform the contract defines", () => {
    for (const platform of SOCIAL_PLATFORMS) {
      expect(GLYPHS).toContain(`  ${platform}:`)
    }
  })
})

describe("the org page's social links", () => {
  it("no longer filters social values on an https prefix the schema never stores", () => {
    expect(ORG_PAGE).not.toContain("socialEntries")
    expect(ORG_PAGE).not.toContain("SOCIAL_ORDER")
    expect(ORG_PAGE).toContain("presentSocialPlatforms(org?.socialLinks)")
  })

  it("renders the shared icon row instead of the raw platform key", () => {
    expect(ORG_PAGE).toContain("<SocialLinksRow links={org.socialLinks} />")
    expect(ORG_PAGE).not.toContain("{entry.key}")
  })
})
