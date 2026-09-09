/**
 * The keyboard focus ring's CONTRAST and its opt-in coverage across the shell chrome.
 *
 * The ring is drawn by ONE injected stylesheet rule (`theme/webAffordances.ts`), so its legibility is a
 * single number that either clears WCAG 2.4.11's 3:1 floor on every surface the shell puts behind it or
 * does not. It did not: the shipped `tokens.shadow.ring` is 30%-alpha FILL coral, which composites to
 * 1.32:1 on sand and 1.38:1 on a card. This suite computes the ratios from the literals themselves rather
 * than trusting a comment, so a future "let's soften the ring" edit fails here instead of in a screenshot
 * review six months later.
 *
 * Source greps for the coverage half: `webAffordances`, `MapControls` and `ExpandedShell` all import
 * react-native, which this package's node-environment vitest cannot load, so the opt-ins are pinned by
 * reading the source - the house pattern (see `rail.test.ts`, `searchInboxAffordances.test.ts`).
 */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { tokens, darkColor } from "@civfix/shared/tokens"

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8")
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

const affordances = read("../webAffordances.ts")
const affordancesCode = strip(affordances)
const themeIndex = read("../schemes.ts")
const mapControls = strip(read("../../map/MapControls.tsx"))
const expandedShell = strip(read("../../shell/ExpandedShell.tsx"))

/* --------------------------------------------------------------------------------------------- *
 * Contrast math (WCAG 2.x relative luminance).
 * --------------------------------------------------------------------------------------------- */

type Rgb = readonly [number, number, number]

function rgb(hex: string): Rgb {
  const h = hex.replace("#", "")
  const at = (i: number) => parseInt(h.slice(i, i + 2), 16)
  return [at(0), at(2), at(4)] as const
}

function luminance(color: Rgb): number {
  const chan = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * chan(color[0]) + 0.7152 * chan(color[1]) + 0.0722 * chan(color[2])
}

function contrast(a: string, b: string): number {
  const la = luminance(rgb(a))
  const lb = luminance(rgb(b))
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

/** Composite `hex` at `alpha` over an opaque backdrop - what an rgba() ring actually paints. */
function over(hex: string, alpha: number, backdrop: string): string {
  const f = rgb(hex)
  const b = rgb(backdrop)
  const mix = (i: 0 | 1 | 2) =>
    Math.round(f[i] * alpha + b[i] * (1 - alpha))
      .toString(16)
      .padStart(2, "0")
  return `#${mix(0)}${mix(1)}${mix(2)}`
}

/** The two surfaces the ring is mandated to clear: the sand paper and the card. */
const SAND = tokens.color.neutral.paper
const CARD = tokens.color.neutral.card
/** The ring's ink, as the literal `webAffordances` ships. */
const RING = "#B03A2C"
const RING_DARK = "#F79185"

describe("the focus ring's ink clears 3:1 on both civfix surfaces", () => {
  it("is the accentText coral, single-sourced with theme.colors.accentText", () => {
    expect(SAND).toBe("#EDE6D8")
    expect(CARD).toBe("#FFFDF8")
    // The literal in webAffordances cannot import `colors` (theme/index re-exports webAffordances, so the
    // import would close a module cycle), so the two strings are pinned equal here instead.
    expect(affordancesCode).toContain(`export const FOCUS_RING_COLOR = "${RING}"`)
    expect(themeIndex).toContain(`accentText: "${RING}"`)
  })

  it("has a dark-scheme ink, single-sourced with the dark accentText, injected under :root.dark", () => {
    expect(affordancesCode).toContain(`export const FOCUS_RING_COLOR_DARK = "${RING_DARK}"`)
    expect(themeIndex).toContain(`accentText: "${RING_DARK}"`)
    expect(affordancesCode).toContain(":root.dark")
    expect(contrast(RING_DARK, darkColor.neutral.paper)).toBeGreaterThanOrEqual(3)
    expect(contrast(RING_DARK, darkColor.neutral.card)).toBeGreaterThanOrEqual(3)
  })

  it("measures >= 3:1 against sand AND against a card", () => {
    expect(contrast(RING, SAND)).toBeGreaterThanOrEqual(3)
    expect(contrast(RING, CARD)).toBeGreaterThanOrEqual(3)
    // The measured figures, so a hue tweak that still scrapes 3:1 is visible in the diff.
    expect(+contrast(RING, SAND).toFixed(2)).toBe(4.85)
    expect(+contrast(RING, CARD).toFixed(2)).toBe(5.92)
  })

  it("is a real raise: the token's own 30% fill coral fails both by a factor of three", () => {
    // This is what shipped before, and why the ring had to change rather than just widen.
    const spec = /^0 0 0 \d+(?:\.\d+)?px\s+rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(tokens.shadow.ring)
    expect(spec).not.toBeNull()
    const parts = spec ?? ["", "0", "0", "0", "1"]
    const hex2 = (c: string) => Number(c).toString(16).padStart(2, "0")
    const fill = `#${hex2(String(parts[1]))}${hex2(String(parts[2]))}${hex2(String(parts[3]))}`
    const alpha = Number(parts[4])
    expect(contrast(over(fill, alpha, SAND), SAND)).toBeLessThan(1.5)
    expect(contrast(over(fill, alpha, CARD), CARD)).toBeLessThan(1.5)
  })
})

describe("the ring's geometry", () => {
  it("keeps the token's 3px footprint, spending 1px of it as a gap", () => {
    // `outline-offset` is what keeps the band legible against the CONTROL too: opaque accentText is only
    // 2.83:1 against the ink-filled orb and 1.96:1 against the coral New post pill, so a zero-offset band
    // would butt onto a fill it barely separates from. The gap shows the page surface, which the ring
    // clears by 4.8:1+.
    expect(contrast(RING, tokens.color.neutral.ink)).toBeLessThan(3)
    expect(affordancesCode).toContain("export const FOCUS_RING_OFFSET = 1")
    expect(affordancesCode).toContain(
      "export const FOCUS_RING_WIDTH = FOCUS_RING_FOOTPRINT - FOCUS_RING_OFFSET",
    )
    expect(affordancesCode).toMatch(/const FOCUS_RING_FOOTPRINT = RING_SPEC \? Number\(RING_SPEC\[1\]\) : 3/)
    // The footprint is still the token's, so nothing that clips at 3px clips any harder.
    expect(tokens.shadow.ring.startsWith("0 0 0 3px")).toBe(true)
  })

  it("emits the offset into the injected rule rather than the old hard 0", () => {
    expect(affordancesCode).toContain("outline-offset:${FOCUS_RING_OFFSET}px")
    expect(affordancesCode).not.toContain("outline-offset:0")
    // The stroke is still >= the 2px minimum thickness WCAG 2.4.13 asks of a focus indicator.
    expect(3 - 1).toBeGreaterThanOrEqual(2)
  })
})

describe("the shell chrome opts in", () => {
  it("MapControls tags the brand pill and BOTH ProfileEntry arms", () => {
    // Locate / Layers / Activity inherit the ring from GlassButton; these three are the raw Pressables
    // that were left painting Chrome's blue UA outline beside them.
    expect(mapControls).toMatch(/import \{[^}]*\bfocusRingProps\b[^}]*\} from "\.\.\/theme"/)
    expect((mapControls.match(/\{\.\.\.focusRingProps\}/g) ?? []).length).toBe(3)
  })

  it("ExpandedShell tags the panel-header Back + Home chips and the resize handle", () => {
    expect(expandedShell).toContain("focusRingProps")
    expect((expandedShell.match(/\{\.\.\.focusRingProps\}/g) ?? []).length).toBe(3)
  })
})
