import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { space } from "@civfix/shared/tokens"
import {
  HEADER_AVATAR_SIZE,
  HEADER_CONTROL_RADIUS,
  HEADER_CONTROL_SIZE,
  HEADER_GLYPH_SIZE,
} from "../headerControls"
import { MAP_ACTION_SIZE, RAIL_BRAND_GLYPH_EM } from "../../shell/expandedFramePlan"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")

const MIN_TOUCH_TARGET = 44
const SMALLEST_PHONE_WIDTH = 375

describe("one header-control token set", () => {
  it("is a single 52pt control with a 26pt glyph and a 52pt avatar", () => {
    expect(HEADER_CONTROL_SIZE).toBe(52)
    expect(HEADER_GLYPH_SIZE).toBe(26)
    expect(HEADER_AVATAR_SIZE).toBe(52)
    expect(HEADER_CONTROL_RADIUS).toBe(HEADER_CONTROL_SIZE / 2)
    expect(HEADER_CONTROL_SIZE).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET)
  })

  it("is what every top-row control measures itself against, with no second literal", () => {
    const sources: ReadonlyArray<[string, string]> = [
      ["HeaderIconButton", read("../HeaderIconButton.tsx")],
      ["HeaderProfileButton", read("../HeaderProfileButton.tsx")],
      ["detailHeader", read("../../shell/detailHeader.ts")],
      ["MapHeaderActions", read("../../map/MapHeaderActions.tsx")],
      ["GlassButton", read("../../primitives/GlassButton.tsx")],
    ]
    for (const [name, source] of sources) {
      expect(source, `${name} does not read the header-control tokens`).toContain(
        "headerControls",
      )
    }
    expect(MAP_ACTION_SIZE).toBe(HEADER_CONTROL_SIZE)
  })

  it("keeps the map's compact row optically centred against the glass controls beside it", () => {
    const map = read("../../map/MapHeaderActions.tsx")
    expect(map).toContain("const rowCenterOffset = (GLASS_CONTROL_SIZE - HEADER_CONTROL_SIZE) / 2")
    expect(map).toContain('{ top: topInset + space["2"] + rowCenterOffset }')
    expect(MAP_ACTION_SIZE - HEADER_CONTROL_SIZE).toBe(0)
  })
})

describe("the compact map's two top rows still clear each other on the smallest phone", () => {
  const controls = read("../../map/MapControls.tsx")

  it("grounds the brand pill's width in what MapControls actually renders", () => {
    expect(controls).toContain("<Brand size={23} />")
    expect(controls).toMatch(/logoPill: \{[\s\S]{0,120}?paddingHorizontal: t\.space\["4"\]/)
    expect(controls).toMatch(/topRow: \{[\s\S]{0,120}?gap: t\.space\["2"\]/)
  })

  it("leaves the wordmark, locate and layers clear of the theme toggle and avatar at 375pt", () => {
    const brandPill = Math.ceil(space["4"] * 2 + 23 * RAIL_BRAND_GLYPH_EM)
    const leftRow =
      space["3"] + brandPill + space["2"] + MAP_ACTION_SIZE + space["2"] + MAP_ACTION_SIZE
    const rightRow = space["3"] + HEADER_CONTROL_SIZE + space["2"] + HEADER_AVATAR_SIZE
    expect(leftRow + rightRow).toBeLessThan(SMALLEST_PHONE_WIDTH)
  })
})
