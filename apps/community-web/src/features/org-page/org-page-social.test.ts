import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { SOCIAL_PLATFORMS } from "@civfix/shared"
import { SOCIAL_GLYPH_PATHS } from "@civfix/ui/social"

const VIEW = readFileSync(new URL("./org-page-view.tsx", import.meta.url), "utf8")
const CSS = readFileSync(new URL("../../app/orgs/org-page.css", import.meta.url), "utf8")

describe("the cold-load org page's social links", () => {
  it("draws the shared brand glyph for every platform the contract defines", () => {
    for (const platform of SOCIAL_PLATFORMS) {
      expect(SOCIAL_GLYPH_PATHS[platform]).toMatch(/^M/)
    }
  })

  it("renders icons instead of the spelled-out platform name", () => {
    expect(VIEW).toContain("presentSocialPlatforms(org.socialLinks)")
    expect(VIEW).toContain("<SocialGlyph platform={entry.platform} />")
    expect(VIEW).not.toContain("socialEntries")
    expect(VIEW).not.toContain("{SOCIAL_PLATFORM_LABELS[entry.platform]}")
  })

  it("labels each link with the same copy the app uses", () => {
    expect(VIEW).toContain('t("profile-view:social.link_a11y"')
  })

  it("styles the row from design tokens, never a literal color", () => {
    const block = CSS.slice(CSS.indexOf(".orgpage-socials"))
    expect(block).toContain("color: var(--fg-3)")
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
