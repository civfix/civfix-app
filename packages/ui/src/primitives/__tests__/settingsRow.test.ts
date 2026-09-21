import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const row = strip(read("../SettingsRow.tsx"))

const MIN_TOUCH_TARGET = 44
const rowMinHeight = Number.parseFloat(
  /const SETTINGS_ROW_MIN_HEIGHT = ([0-9.]+)/.exec(row)?.[1] ?? "NaN",
)

describe("SettingsRow", () => {
  it("clears the 44pt touch-target floor from its own box, not from hitSlop", () => {
    expect(rowMinHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET)
    expect(row).toContain("minHeight: SETTINGS_ROW_MIN_HEIGHT")
  })

  it("renders the SHARED switch seam rather than a second pill implementation", () => {
    expect(row).toContain('import { SettingsToggle } from "./SettingsToggle"')
    expect(row).toContain("<SettingsToggle")
    expect(row).not.toMatch(/KNOB_ON_X|TRACK_OFF/)
  })

  it("leaves the toggle row's label column out of the tab order (one row, one stop)", () => {
    expect(row).toContain("focusable={false}")
    expect(row).toContain("tabIndex: -1")
  })

  it("gives every focusable stop the coral ring", () => {
    expect(row).toContain(
      'import { makeThemedStyles, space, useTheme, focusRingProps, webCursor, headingLevel } from "../theme"',
    )
    expect(row.match(/\{\.\.\.focusRingProps\}/g) ?? []).toHaveLength(2)
  })

  it("colours a destructive row with the danger role, never the brand accent", () => {
    expect(row).toContain("color: t.colors.dangerInk")
    expect(row).toContain("backgroundColor: t.colors.dangerWash")
    expect(row).not.toMatch(/\bt\.colors\.accent(Text)?\b/)
    expect(row).not.toMatch(/t\.colors\.bloom\[/)
  })

  it("hardcodes no hex, size scale or radius that a token already names", () => {
    expect(row).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(row).toContain("borderRadius: t.radius.lg")
    expect(row).toContain("borderRadius: t.radius.md")
  })

  it("drops the chevron for a destructive row and for an explicit `chevron={false}`", () => {
    expect(row).toContain("const showChevron = chevron ?? !destructive")
    expect(row).toContain("showChevron ? (")
  })

  it("renders a read-only row (no onPress) as a plain View, never as a dead Pressable", () => {
    expect(row).toContain("if (!onPress) {")
  })
})

describe("SettingsSection", () => {
  it("is ONE card with hairline dividers between rows, inset past the icon column", () => {
    expect(row).toContain("const DIVIDER_INSET = ROW_PAD_H + ICON_TILE + ROW_GAP")
    expect(row).toContain("marginLeft: DIVIDER_INSET")
    expect(row).toContain("height: StyleSheet.hairlineWidth")
    expect(row).toContain("index > 0 ? <View style={styles.divider} /> : null")
  })

  it("labels the section with a real heading, not a styled string", () => {
    expect(row).toContain('accessibilityRole="header"')
    expect(row).toContain("headingLevel(2)")
  })

  it("keeps the eyebrow visually identical to the profile's SectionEyebrow", () => {
    const eyebrow = /eyebrow: \{[\s\S]*?\}/.exec(row)?.[0] ?? ""
    expect(eyebrow).toContain("fontFamily: t.fontFamily.bodyExtraBold")
    expect(eyebrow).toContain('fontSize: t.fontSize["12"]')
    expect(eyebrow).toContain("lineHeight: 16")
    expect(eyebrow).toContain("letterSpacing: 0.6")
    expect(eyebrow).toContain("color: t.colors.textSubtle")
  })
})

describe("the settings row shares ONE rhythm with ListRow", () => {
  const listRow = strip(read("../ListRow.tsx"))
  const listTile = Number.parseFloat(/const LIST_TILE = ([0-9.]+)/.exec(listRow)?.[1] ?? "NaN")

  it("wears the same 40pt tile the list card's rows do", () => {
    expect(row).toContain("const ICON_TILE = 40")
    expect(listTile).toBe(40)
  })

  it("takes its horizontal padding and vertical rhythm from the space scale", () => {
    expect(row).toContain('const ROW_PAD_H = space["4"]')
    expect(row).toContain('paddingVertical: t.space["2"]')
    expect(row).not.toMatch(/padding(Vertical|Horizontal): [0-9]/)
  })

  it("puts the row text on the same x as a ListRow's, 68 past the card edge", () => {
    const listInset = /const LIST_DIVIDER_INSET = space\["4"\] \+ LIST_TILE \+ space\["3"\]/.test(
      listRow,
    )
    expect(listInset).toBe(true)
    expect(row).toContain("const DIVIDER_INSET = ROW_PAD_H + ICON_TILE + ROW_GAP")
    expect(row).toContain('const ROW_GAP = space["3"]')
  })

  it("draws its glyph at the 18pt size both rows use", () => {
    expect(row).toContain("size={18}")
    expect(row).not.toContain("size={16}")
  })
})

describe("the Account card's avatar row shares that rhythm exactly", () => {
  const avatar = strip(read("../../bodies/settings/AvatarSettingRow.tsx"))

  it("wears the SAME 40pt leading tile, so the divider inset of 68 lands on its text", () => {
    expect(avatar).toContain("size={LIST_TILE}")
    expect(avatar).toContain("width: LIST_TILE")
    expect(avatar).toContain("height: LIST_TILE")
    expect(avatar).not.toMatch(/const AVATAR_SIZE/)
  })

  it("takes its padding and gap off the same scale SettingsRow does", () => {
    expect(avatar).toContain('const ROW_PAD_H = space["4"]')
    expect(avatar).toContain('const ROW_GAP = space["3"]')
    expect(avatar).toContain("paddingHorizontal: ROW_PAD_H")
    expect(avatar).toContain("gap: ROW_GAP")
    expect(avatar).toContain('paddingVertical: t.space["2"]')
    expect(avatar).not.toMatch(/padding(Vertical|Horizontal): [0-9]/)
  })

  it("clears the same touch-target floor from its own box", () => {
    expect(avatar).toContain("minHeight: SETTINGS_ROW_MIN_HEIGHT")
    expect(rowMinHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET)
  })
})

describe("the outbound URLs are stated once", () => {
  it("is the ONE module both the About card and the Settings hub read them from", () => {
    const urls = strip(read("../externalUrls.ts"))
    expect(urls).toContain('export const DONATE_URL = "https://reachoutla.org/help"')
    expect(urls).toContain('export const WEB_ORIGIN = "https://civfix.org"')
    expect(urls).toContain("export const TERMS_URL = `${WEB_ORIGIN}/legal/terms`")
    expect(urls).toContain("export const PRIVACY_URL = `${WEB_ORIGIN}/legal/privacy`")
    expect(urls).toContain('export const SOURCE_REPO_URL = "https://github.com/civfix/civfix-app"')
    expect(strip(read("../share.ts"))).not.toMatch(/= "https:\/\/civfix\.org"/)
    for (const rel of ["../BrandAboutCard.tsx", "../../bodies/SettingsBody.tsx"]) {
      const src = strip(read(rel))
      expect(src, rel).toMatch(/DONATE_URL/)
      expect(src, rel).not.toMatch(/"https:\/\/(reachoutla\.org|civfix\.org\/legal|github\.com)/)
    }
  })
})
