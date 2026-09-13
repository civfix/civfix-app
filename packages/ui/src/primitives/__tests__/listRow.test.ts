import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const src = strip(read("../ListRow.tsx"))
const index = strip(read("../index.ts"))

const num = (name: string): number =>
  Number.parseFloat(new RegExp(`const ${name} = ([0-9.]+)`).exec(src)?.[1] ?? "NaN")

const styleBlock = (name: string): string => {
  const found = new RegExp(`\\n  ${name}: \\{([\\s\\S]*?)\\n  \\},`).exec(src)
  if (!found || found[1] === undefined) throw new Error(`style "${name}" not found`)
  return found[1]
}

describe("ListRow is the one row geometry every list card shares", () => {
  it("stands 56 tall on a 40pt leading tile", () => {
    expect(num("LIST_TILE")).toBe(40)
    expect(num("LIST_ROW_MIN_HEIGHT")).toBe(56)
    expect(styleBlock("row")).toContain("minHeight: LIST_ROW_MIN_HEIGHT")
    expect(styleBlock("leading")).toContain("width: LIST_TILE")
    expect(styleBlock("leading")).toContain("height: LIST_TILE")
  })

  it("derives the divider inset from the geometry instead of restating 68", () => {
    expect(src).toContain('export const LIST_DIVIDER_INSET = space["4"] + LIST_TILE + space["3"]')
  })

  it("spends every dimension on a token, never on a bare number", () => {
    for (const name of ["row", "meta", "tile"]) {
      expect(styleBlock(name), name).not.toMatch(/(padding|margin|gap)[A-Za-z]*: [0-9]/)
    }
    expect(styleBlock("row")).toContain('gap: t.space["3"]')
    expect(styleBlock("row")).toContain('paddingVertical: t.space["2"]')
    expect(styleBlock("row")).toContain('paddingHorizontal: t.space["4"]')
    expect(styleBlock("meta")).toContain('gap: t.space["1"]')
    expect(styleBlock("tile")).toContain("borderRadius: t.radius.md")
  })

  it("hardcodes no colour", () => {
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it("reads the scheme at render time, never the static theme", () => {
    expect(src).not.toMatch(/import \{[^}]*\b(theme|colors|glass|shadows)\b[^}]*\} from "\.\.\/theme"/)
  })

  it("keeps the title on one type step and lets it run to two lines by default", () => {
    const title = styleBlock("title")
    expect(title).toContain("fontFamily: t.fontFamily.bodyBold")
    expect(title).toContain('fontSize: t.fontSize["15"]')
    expect(title).toContain("lineHeight: 20")
    expect(src).toContain("numberOfLines={titleLines ?? 2}")
  })

  it("renders a string sub as a caption and a node sub as authored", () => {
    expect(src).toContain('typeof sub === "string"')
    expect(src).toContain('<Text variant="caption" numberOfLines={1}>')
  })

  it("drops an action line beneath the text column when a footer is given", () => {
    expect(src).toContain("{footer ? <View style={styles.footer}>{footer}</View> : null}")
    expect(styleBlock("footer")).toContain('paddingLeft: LIST_TILE + t.space["3"]')
    expect(styleBlock("line")).toContain('flexDirection: "row"')
    expect(styleBlock("line")).toContain('alignItems: "center"')
    expect(styleBlock("row")).toContain('justifyContent: "center"')
  })

  it("renders a string trailing as the row value and a node trailing as authored", () => {
    expect(src).toContain('typeof trailing === "string"')
    const value = styleBlock("rowValue")
    expect(value).toContain("fontFamily: t.fontFamily.bodySemiBold")
    expect(value).toContain('fontSize: t.fontSize["13"]')
    expect(value).toContain("lineHeight: 18")
    expect(styleBlock("trailing")).toContain("flexShrink: 0")
  })

  it("is a plain View without onPress and a ringed button with it", () => {
    expect(src).toContain("if (!onPress) {")
    expect(src).toContain('accessibilityRole="button"')
    expect(src).toContain("{...focusRingProps}")
    expect(src).toContain("accessibilityLabel={accessibilityLabel ?? title}")
  })

  it("answers a press with bgAlt and a web hover with surfaceTint", () => {
    expect(styleBlock("pressed")).toContain("backgroundColor: t.colors.bgAlt")
    expect(styleBlock("hovered")).toContain("backgroundColor: t.colors.surfaceTint")
    expect(src).toContain("webHover(state) ? styles.hovered : null")
    expect(src).toContain("state.pressed ? styles.pressed : null")
  })

  it("draws the chevron at 18 on the subtle ink, like every other row", () => {
    expect(src).toContain("<Icon icon={iconMap.ChevronRight} size={18} color={t.colors.textSubtle} />")
  })
})

describe("IconTile is the leading glyph of a list row", () => {
  it("fills each tone from a role token, never a palette literal", () => {
    expect(styleBlock("tile")).toContain("backgroundColor: t.colors.bgAlt")
    expect(styleBlock("tileAttention")).toContain('backgroundColor: t.colors.sun["50"]')
    expect(styleBlock("tileSuccess")).toContain("backgroundColor: t.colors.successWash")
    expect(src).toContain('t.colors.sun["700"]')
    expect(src).toContain("t.colors.successInk")
    expect(src).toContain("t.colors.textMuted")
  })

  it("takes a semantic icon name so a caller needs no lucide import", () => {
    expect(src).toContain("icon: IconName")
    expect(src).toContain("<Icon icon={iconMap[icon]} size={18} color={ink} />")
  })

  it("fits the 40pt leading slot exactly", () => {
    const tile = styleBlock("tile")
    expect(tile).toContain("width: LIST_TILE")
    expect(tile).toContain("height: LIST_TILE")
    expect(tile).toContain("flexShrink: 0")
  })
})

describe("the package publishes the row and its geometry", () => {
  it("exports ListRow, IconTile and the three constants", () => {
    expect(index).toContain(
      'export { ListRow, IconTile, LIST_TILE, LIST_ROW_MIN_HEIGHT, LIST_DIVIDER_INSET } from "./ListRow"',
    )
    expect(index).toContain(
      'export type { ListRowProps, IconTileProps, IconTileTone } from "./ListRow"',
    )
  })
})
