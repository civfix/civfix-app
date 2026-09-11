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

  it("colours a destructive label with the WCAG-safe coral INK token", () => {
    expect(row).toContain("color: t.colors.accentText")
    expect(row).not.toMatch(/\bt\.colors\.accent\b(?!Text)/)
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
    expect(eyebrow).toContain("fontSize: 11")
    expect(eyebrow).toContain("letterSpacing: 0.6")
    expect(eyebrow).toContain("color: t.colors.textSubtle")
  })
})

describe("the outbound URLs are stated once", () => {
  it("is the ONE module both the About card and the Settings hub read them from", () => {
    const urls = strip(read("../externalUrls.ts"))
    expect(urls).toContain('export const DONATE_URL = "https://reachoutla.org/help"')
    expect(urls).toContain('export const WEB_ORIGIN = "https://civfix.org"')
    expect(urls).toContain("export const TERMS_URL = `${WEB_ORIGIN}/legal/terms`")
    expect(urls).toContain("export const PRIVACY_URL = `${WEB_ORIGIN}/legal/privacy`")
    expect(strip(read("../share.ts"))).not.toMatch(/= "https:\/\/civfix\.org"/)
    for (const rel of ["../BrandAboutCard.tsx", "../../bodies/SettingsBody.tsx"]) {
      const src = strip(read(rel))
      expect(src, rel).toMatch(/DONATE_URL/)
      expect(src, rel).not.toMatch(/"https:\/\/(reachoutla\.org|civfix\.org\/legal)/)
    }
  })
})
