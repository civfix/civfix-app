/**
 * IconActionButton imports react-native, which this package's node vitest cannot load, so its contract is
 * pinned in source: the drawn size, the slop that reaches the 44pt floor, and the style layering the
 * NextUpCard share button depends on.
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { expectInSourceOrder, expectThemeHitSlop, sliceBetween } from "../../__tests__/sourceGuards"

const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

const BUTTON = strip(read("../IconActionButton.tsx"))

describe("IconActionButton", () => {
  it("draws a 32pt circle and reaches 44pt on native through the theme slop", () => {
    expect(BUTTON).toContain("export const ICON_ACTION_SIZE = 32")
    const slopFor = expectThemeHitSlop(BUTTON)
    expect(32 + 2 * slopFor(32)).toBe(44)
    expect(BUTTON).toContain("const ICON_ACTION_HIT_SLOP = hitSlopToTarget(ICON_ACTION_SIZE)")
    expect(BUTTON).toContain("hitSlop={ICON_ACTION_HIT_SLOP}")
    expect(BUTTON).toMatch(/button: \{\s*width: ICON_ACTION_SIZE,\s*height: ICON_ACTION_SIZE,/)
    expect(BUTTON).toContain("borderRadius: t.radius.pill")
  })

  it("is a named button with the house focus ring", () => {
    expect(BUTTON).toContain('accessibilityRole="button"')
    expect(BUTTON).toContain("accessibilityLabel={accessibilityLabel}")
    expect(BUTTON).toContain("accessibilityState={accessibilityState}")
    expect(BUTTON).toContain("{...focusRingProps}")
  })

  it("layers the caller's style over the box and under the hover and press states", () => {
    const style = sliceBetween(BUTTON, "style={(state) => [", "]}")
    expectInSourceOrder(style, [
      "styles.button,",
      "style,",
      "webTransition,",
      "webCursorPointer,",
      "webHover(state) ? styles.hovered : null,",
      "state.pressed ? styles.pressed : null,",
    ])
    expect(BUTTON).toMatch(/hovered: \{\s*backgroundColor: t\.colors\.bgAlt,/)
    expect(BUTTON).toContain("const ICON_ACTION_PRESSED_OPACITY = 0.92")
    expect(BUTTON).toContain("<Icon icon={icon} size={ICON_ACTION_GLYPH} color={iconColor} />")
    expect(BUTTON).toContain("const ICON_ACTION_GLYPH = 18")
  })

  it.each([
    ["bodies/host/dashboard/HostedEventRow.tsx", 2],
    ["bodies/host/dashboard/NextUpCard.tsx", 1],
    ["bodies/host/dashboard/CollaboratorsSection.tsx", 1],
  ])("%s draws its round icon actions through it", (rel, count) => {
    const src = strip(read(`../../${rel}`))
    expect(src.match(/<IconActionButton\b/g) ?? []).toHaveLength(count)
    expect(src).not.toMatch(/const [A-Z_]+_HIT_SLOP = /)
  })
})
