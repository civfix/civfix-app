import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const src = strip(read("../SectionCard.tsx"))
const index = strip(read("../index.ts"))

const styleBlock = (name: string): string => {
  const found = new RegExp(`\\n  ${name}: \\{([\\s\\S]*?)\\n  \\},`).exec(src)
  if (!found || found[1] === undefined) throw new Error(`style "${name}" not found`)
  return found[1]
}

describe("the section header never wraps", () => {
  it("lays the eyebrow and its trailing element on ONE line", () => {
    const header = styleBlock("header")
    expect(header).not.toContain("flexWrap")
    expect(header).toContain('justifyContent: "space-between"')
    expect(header).toContain('alignItems: "center"')
    expect(header).toContain("minHeight: 16")
    expect(header).toContain('gap: t.space["2"]')
  })

  it("lets the eyebrow shrink and clip rather than push the trailing element down", () => {
    const eyebrow = styleBlock("eyebrow")
    expect(eyebrow).toContain("flexShrink: 1")
    expect(eyebrow).not.toContain("flexGrow")
    expect(src).toContain("numberOfLines={1}")
  })

  it("gives the trailing element a fixed width, so it can never claim the header", () => {
    const trailing = styleBlock("trailing")
    expect(trailing).toContain("flexShrink: 0")
    expect(trailing).not.toContain("flexGrow")
  })

  it("sets the eyebrow on the 12/16 type step the whole app's eyebrows share", () => {
    const eyebrow = styleBlock("eyebrow")
    expect(eyebrow).toContain('fontSize: t.fontSize["12"]')
    expect(eyebrow).toContain("lineHeight: 16")
    expect(eyebrow).toContain("fontFamily: t.fontFamily.bodyExtraBold")
    expect(eyebrow).toContain("letterSpacing: 0.6")
    expect(eyebrow).not.toMatch(/fontSize: [0-9]/)
  })

  it("labels the section with a real heading at level 2", () => {
    expect(src).toContain('accessibilityRole="header"')
    expect(src).toContain("headingLevel(2)")
  })
})

describe('variant="list" turns the card into a divided row stack', () => {
  it("drops the side padding, keeps a corner-clearing inset, and clips the rows to the radius", () => {
    const cardList = styleBlock("cardList")
    expect(cardList).toContain("paddingHorizontal: 0")
    expect(cardList).toContain('paddingVertical: t.space["2"]')
    expect(cardList).toContain('overflow: "hidden"')
    expect(src).toContain("list ? styles.cardList : null")
  })

  it("interleaves a hairline divider between children, never around them", () => {
    expect(src).toContain('const list = variant === "list"')
    expect(src).toContain("React.Children.toArray(children).filter(Boolean)")
    expect(src).toContain("index > 0 ? <View style={rowDivider} /> : null")
    expect(styleBlock("divider")).toContain("height: StyleSheet.hairlineWidth")
    expect(styleBlock("divider")).toContain("backgroundColor: t.colors.border")
  })

  it("insets the row dividers only when the caller asks for it", () => {
    expect(src).toContain(
      "const rowDivider = dividerInset ? [styles.divider, { marginLeft: dividerInset }] : styles.divider",
    )
    expect(styleBlock("divider")).not.toContain("marginLeft")
  })

  it("closes a listHeader with one FULL-WIDTH divider, whatever the row inset is", () => {
    const header = /\{listHeader \? \([\s\S]*?\) : null\}/.exec(src)?.[0] ?? ""
    expect(header).toContain("{listHeader}")
    expect(header).toContain("<View style={styles.divider} />")
    expect(header).not.toContain("rowDivider")
  })

  it("never carries a SegmentedControl as `trailing` - a range switch is a listHeader", () => {
    const surfaces = [
      "../../bodies/host/EventDashboardBody.tsx",
      "../../bodies/host/HostInsightsPanels.tsx",
      "../../../../../apps/community-web/src/components/dev/primitives-gallery.tsx",
    ]
    for (const rel of surfaces) {
      const surface = strip(read(rel))
      const trailings = surface.match(/trailing=\{[\s\S]*?\n\s*\}/g) ?? []
      for (const block of trailings) {
        expect(block, rel).not.toContain("<SegmentedControl")
      }
    }
  })

  it("leaves the padded variant rendering its children untouched", () => {
    expect(src).toMatch(
      /const rows = list \? React\.Children\.toArray\(children\)\.filter\(Boolean\) : null/,
    )
    expect(src).toMatch(/\) : \(\s*children\s*\)\}/)
  })
})

describe("the card is token-only", () => {
  it("hardcodes no colour", () => {
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it("takes its shell from the surface, radius, border and elevation roles", () => {
    const card = styleBlock("card")
    expect(card).toContain("backgroundColor: t.colors.surface")
    expect(card).toContain("borderRadius: t.radius.lg")
    expect(card).toContain("borderWidth: StyleSheet.hairlineWidth")
    expect(card).toContain("borderColor: t.colors.border")
    expect(card).toContain('paddingVertical: t.space["4"]')
    expect(card).toContain('paddingHorizontal: t.space["4"]')
    expect(card).toContain("...t.shadows.s1")
  })
})

describe("the package publishes the variant", () => {
  it("exports the variant union next to the props", () => {
    expect(index).toContain(
      'export type { SectionCardProps, SectionCardVariant } from "./SectionCard"',
    )
    expect(src).toContain('export type SectionCardVariant = "padded" | "list"')
  })
})
