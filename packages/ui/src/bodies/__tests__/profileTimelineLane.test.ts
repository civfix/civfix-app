import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { personDetailSource } from "../personDetail/__tests__/personDetailSource"

const read = (relative: string): string =>
  readFileSync(new URL(relative, import.meta.url), "utf8")

const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const HOSTS = {
  "profile/ProfilePostsSection.tsx": read("../profile/ProfilePostsSection.tsx"),
  "PersonDetailBody.tsx": personDetailSource(),
  "SavedPostsBody.tsx": read("../SavedPostsBody.tsx"),
  "PostDetailBody.tsx": read("../PostDetailBody.tsx"),
}

const LANE = read("../profile/ProfileTimelineLane.tsx")

describe("no timeline host declares its own full-bleed margin", () => {
  for (const [name, source] of Object.entries(HOSTS)) {
    it(`${name} leaves the bleed to the lane`, () => {
      const code = stripComments(source)
      expect(code).not.toMatch(/marginHorizontal:\s*-/)
      expect(code).toMatch(/ProfileTimelineLane/)
    })
  }

})

const PAGE_SURFACES: Record<keyof typeof HOSTS, { file: string; style: string }> = {
  "profile/ProfilePostsSection.tsx": { file: "ProfileBody.tsx", style: "scroll" },
  "PersonDetailBody.tsx": { file: "personDetail/personDetailStyles.ts", style: "root" },
  "SavedPostsBody.tsx": { file: "SavedPostsBody.tsx", style: "root" },
  "PostDetailBody.tsx": { file: "PostDetailBody.tsx", style: "root" },
}

describe("every lane host sits on a surface that paints the page background", () => {
  for (const [host, { file, style }] of Object.entries(PAGE_SURFACES)) {
    it(`${host} -> ${file} styles.${style}`, () => {
      const block = new RegExp(`\\b${style}:\\s*\\{([^{}]*)\\}`).exec(stripComments(read(`../${file}`)))
      expect(block, `${file} declares no styles.${style}`).not.toBeNull()
      expect(block?.[1]).toMatch(/backgroundColor: t\.colors\.bg/)
    })
  }
})

describe("the lane itself", () => {
  it("paints PostCard's own background, so the rows have no seam against it", () => {
    expect(LANE).toMatch(/backgroundColor: t\.colors\.bg/)
  })

  it("draws a TOP hairline only - the last row's separator is the bottom edge", () => {
    expect(LANE).toMatch(/borderTopWidth: StyleSheet\.hairlineWidth/)
    expect(LANE).not.toMatch(/borderBottomWidth/)
  })
})

describe("the bleed prop", () => {
  it("is exactly negated into the margin, so a padding-free host gets none", () => {
    expect(LANE).toMatch(/function timelineLaneBleedStyle\(bleed: number\)/)
    expect(LANE).toMatch(/return \{ marginHorizontal: -bleed \}/)
    expect(LANE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")).not.toMatch(
      /marginHorizontal:\s*-(?!bleed)/,
    )
  })

  it("is 16 for the padded hosts and 0 for the padding-free ones", () => {
    expect(LANE).toMatch(/PROFILE_TIMELINE_BLEED = space\["4"\]/)
    expect(HOSTS["profile/ProfilePostsSection.tsx"]).toMatch(/bleed=\{PROFILE_TIMELINE_BLEED\}/)
    expect(HOSTS["PersonDetailBody.tsx"]).toMatch(/bleed=\{PROFILE_TIMELINE_BLEED\}/)
    expect(HOSTS["SavedPostsBody.tsx"]).toMatch(/bleed=\{0\}/)
    expect(HOSTS["PostDetailBody.tsx"]).toMatch(/bleed=\{0\}/)
  })
})
