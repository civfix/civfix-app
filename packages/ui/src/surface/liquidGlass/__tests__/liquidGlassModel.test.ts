import { readFileSync } from "node:fs"
import { describe, it, expect } from "vitest"
import {
  dockShapes,
  dockRadius,
  MIN_K,
  morphUniforms,
  parseRgba,
  lerp,
  smoothstep,
  DOCK_H,
  DOCK_GAP,
  DOCK_MORPH_SHRINK,
  DOCK_MORPH_TOP_OFFSET,
} from "../liquidGlassModel"

const DOCKED_D = DOCK_H - DOCK_MORPH_SHRINK
const DOCKED_CY = DOCK_MORPH_TOP_OFFSET + DOCKED_D / 2

describe("LiquidGlassDock shadow structure (native seam)", () => {
  const source = readFileSync(new URL("../LiquidGlassDock.native.tsx", import.meta.url), "utf8")

  it("keeps the shadow-wrapper frame UNCLIPPED so iOS does not mask the drop shadow", () => {
    const afterFrame = source.slice(source.indexOf("function frameStyle"))
    const frameBody = afterFrame.slice(0, afterFrame.indexOf("function clipStyle"))
    expect(frameBody).not.toMatch(/overflow/)
  })

  it("clips the live blur on the CHILD (clipStyle), not the shadow-casting wrapper", () => {
    const clipStyle = source.slice(source.indexOf("function clipStyle"), source.indexOf("export function LiquidGlassDock"))
    expect(clipStyle).toMatch(/overflow:\s*"hidden"/)
  })

  it("applies the nav shadow to BOTH morphing shape wrappers (left + right)", () => {
    const shadowApplications =
      source.match(/\[styles\.shapeFrame,\s*(?:leftStyle|rightStyle),\s*shadowStyle\]/g) ?? []
    expect(shadowApplications.length).toBeGreaterThanOrEqual(2)
    expect(source).toMatch(/\[styles\.clearFrame,\s*shadowStyle,\s*clearStyle\]/)
    expect(source).toMatch(/function dockShadowStyle\(t: Theme\) \{/)
    expect(source).toMatch(/const shadowStyle = useMemo\(\(\) => dockShadowStyle\(t\), \[t\]\)/)
  })

  it("places the trailing ✕ by TRANSFORM off a constant frame (no per-frame Yoga pass for that shape)", () => {
    expect(source).toMatch(/const CLEAR_BASE = DOCK_H - DOCK_MORPH_SHRINK/)
    const clearBlock = source.slice(
      source.indexOf("const clearStyle = useAnimatedStyle"),
      source.indexOf("const clip = useMemo"),
    )
    expect(clearBlock).toMatch(/translateX: f\.x \+ f\.width \/ 2 - CLEAR_BASE \/ 2/)
    expect(clearBlock).toMatch(/translateY: f\.y \+ f\.height \/ 2 - CLEAR_BASE \/ 2/)
    expect(clearBlock).toMatch(/scale: f\.width \/ CLEAR_BASE/)
    expect(clearBlock).toMatch(/opacity: focusV\.value/)
    expect(source).not.toMatch(/clearBodyStyle/)
  })

  it("no longer carries the dead glassFade crossfade nor a ghost orb frame", () => {
    expect(source).not.toMatch(/glassFade/)
    expect(source).not.toMatch(/orbBlurFrame/)
  })
})

const REGION_W = 390

describe("dockShapes (mirrored width-swap geometry)", () => {
  it("REST (p=0): wide left capsule + detached H-wide right orb, both height H", () => {
    const { left, right } = dockShapes(0, REGION_W)
    expect(left.x).toBe(0)
    expect(left.width).toBeCloseTo(REGION_W - DOCK_H - DOCK_GAP)
    expect(left.height).toBeCloseTo(DOCK_H)
    expect(right.width).toBeCloseTo(DOCK_H)
    expect(right.x + right.width).toBeCloseTo(REGION_W)
    expect(right.height).toBeCloseTo(DOCK_H)
  })

  it("DOCKED (p=1): left circle (DOCKED_D wide) + wide right field, both height DOCKED_D", () => {
    const { left, right } = dockShapes(1, REGION_W)
    expect(left.x).toBe(0)
    expect(left.width).toBeCloseTo(DOCKED_D)
    expect(right.width).toBeCloseTo(REGION_W - DOCKED_D - DOCK_GAP)
    expect(right.x + right.width).toBeCloseTo(REGION_W)
    expect(left.height).toBeCloseTo(DOCKED_D)
    expect(right.height).toBeCloseTo(DOCKED_D)
    expect(left.width).toBeCloseTo(left.height)
    expect(left.x + left.width / 2).toBeCloseTo(DOCKED_D / 2)
    expect(left.y + left.height / 2).toBeCloseTo(DOCKED_CY)
  })

  it("slims TOP-ALIGNED (DOCK_MORPH_SHRINK = 16): 48-tall docked shapes whose top hugs the band top", () => {
    expect(DOCK_MORPH_SHRINK).toBe(16)
    expect(DOCKED_D).toBe(DOCK_H - 16)
    expect(DOCK_MORPH_TOP_OFFSET).toBeGreaterThanOrEqual(0)
    expect(DOCK_MORPH_TOP_OFFSET).toBeLessThanOrEqual(2)
    const { left, right, clear } = dockShapes(1, REGION_W, 1)
    expect(left.height).toBeCloseTo(DOCKED_D)
    expect(right.height).toBeCloseTo(DOCKED_D)
    for (const rect of [left, right, clear]) {
      expect(rect.y).toBeCloseTo(DOCK_MORPH_TOP_OFFSET)
      expect(rect.y).toBeGreaterThanOrEqual(0)
      expect(rect.y).toBeLessThanOrEqual(2)
    }
    expect(left.y + left.height / 2).toBeCloseTo(DOCKED_CY)
    expect(right.y + right.height / 2).toBeCloseTo(DOCKED_CY)
    expect(clear.y + clear.height / 2).toBeCloseTo(DOCKED_CY)
    expect(left.x + left.width / 2).toBeCloseTo(DOCKED_D / 2)
    const min = dockShapes(0, REGION_W, 0, 1)
    expect(min.left.x + min.left.width / 2).toBeCloseTo(DOCK_H / 2)
    expect(min.left.y + min.left.height / 2).toBeCloseTo(DOCK_H / 2)
  })

  it("keeps the gap CONSTANT at G for every progress (leftW + rightW === T - G)", () => {
    for (const p of [0, 0.15, 0.37, 0.5, 0.62, 0.88, 1]) {
      const { left, right } = dockShapes(p, REGION_W)
      const gap = right.x - (left.x + left.width)
      expect(gap).toBeCloseTo(DOCK_GAP)
      expect(left.width + right.width).toBeCloseTo(REGION_W - DOCK_GAP)
    }
  })

  it("left width shrinks monotonically, right width grows monotonically", () => {
    const ps = [0, 0.25, 0.5, 0.75, 1]
    const lefts = ps.map((p) => dockShapes(p, REGION_W).left.width)
    const rights = ps.map((p) => dockShapes(p, REGION_W).right.width)
    for (let i = 1; i < ps.length; i++) {
      expect(lefts[i]!).toBeLessThanOrEqual(lefts[i - 1]! + 1e-9)
      expect(rights[i]!).toBeGreaterThanOrEqual(rights[i - 1]! - 1e-9)
    }
  })

  it("squash: capsule flattens + field bulges around the per-progress unit, clean at both endpoints", () => {
    const rest = dockShapes(0, REGION_W)
    const mid = dockShapes(0.5, REGION_W)
    const end = dockShapes(1, REGION_W)
    expect(rest.left.height).toBeCloseTo(DOCK_H)
    expect(rest.right.height).toBeCloseTo(DOCK_H)
    expect(end.left.height).toBeCloseTo(DOCKED_D)
    expect(end.right.height).toBeCloseTo(DOCKED_D)
    const midUnit = (DOCK_H + DOCKED_D) / 2
    expect(mid.right.height).toBeGreaterThan(midUnit)
    expect(mid.left.height).toBeLessThan(midUnit)
    expect(mid.right.height - midUnit).toBeCloseTo(midUnit - mid.left.height, 5)
  })

  it("both shapes share ONE centerline that eases band-center (32) -> docked slim center (26)", () => {
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      const { left, right } = dockShapes(p, REGION_W)
      const expected = p * DOCK_MORPH_TOP_OFFSET + (DOCK_H - p * DOCK_MORPH_SHRINK) / 2
      expect(left.y + left.height / 2).toBeCloseTo(expected)
      expect(right.y + right.height / 2).toBeCloseTo(expected)
    }
    expect(dockShapes(0, REGION_W).left.y).toBeCloseTo(0)
    expect(dockShapes(1, REGION_W).left.y).toBeCloseTo(DOCK_MORPH_TOP_OFFSET)
  })

  it("clamps progress outside [0,1]", () => {
    expect(dockShapes(-0.5, REGION_W)).toEqual(dockShapes(0, REGION_W))
    expect(dockShapes(1.5, REGION_W)).toEqual(dockShapes(1, REGION_W))
  })

  it("FOCUS: keeps the leading circle, shrinks the field from the right, slides in a SEPARATE ✕ circle", () => {
    expect(dockShapes(1, REGION_W)).toEqual(dockShapes(1, REGION_W, 0))
    const docked = dockShapes(1, REGION_W, 0)
    expect(docked.left.width).toBeCloseTo(DOCKED_D)
    expect(docked.right.x + docked.right.width).toBeCloseTo(REGION_W)
    expect(docked.clear.x).toBeGreaterThanOrEqual(REGION_W)

    const focused = dockShapes(1, REGION_W, 1)
    expect(focused.left.x).toBe(0)
    expect(focused.left.width).toBeCloseTo(DOCKED_D)
    expect(focused.left).toEqual(docked.left)
    expect(focused.right.x).toBeCloseTo(DOCKED_D + DOCK_GAP)
    expect(focused.right.width).toBeCloseTo(REGION_W - DOCKED_D - DOCK_GAP - DOCKED_D - DOCK_GAP)
    expect(focused.clear.width).toBeCloseTo(DOCKED_D)
    expect(focused.clear.height).toBeCloseTo(DOCKED_D)
    expect(focused.clear.x).toBeCloseTo(REGION_W - DOCKED_D)
    expect(focused.clear.x + focused.clear.width).toBeCloseTo(REGION_W)
    expect(focused.right.x - (focused.left.x + focused.left.width)).toBeCloseTo(DOCK_GAP)
    expect(focused.clear.x - (focused.right.x + focused.right.width)).toBeCloseTo(DOCK_GAP)
    const half = dockShapes(1, REGION_W, 0.5)
    expect(half.right.width).toBeLessThan(docked.right.width)
    expect(half.right.width).toBeGreaterThan(focused.right.width - 1e-9)
    expect(half.clear.x).toBeLessThan(docked.clear.x)
    expect(half.clear.x).toBeGreaterThan(focused.clear.x - 1e-9)
    for (const f of [0.25, 0.5, 0.75, 1]) {
      const s = dockShapes(1, REGION_W, f)
      expect(s.clear.x - (s.right.x + s.right.width)).toBeCloseTo(DOCK_GAP)
    }
    expect(dockShapes(1, REGION_W, 1.5)).toEqual(dockShapes(1, REGION_W, 1))
    expect(dockShapes(1, REGION_W, -0.5)).toEqual(dockShapes(1, REGION_W, 0))
  })
})

describe("dockShapes MINIMIZE (Apple-Music scroll-collapse of the left shape)", () => {
  it("collapses the REST left shape to an H circle at the leading margin (minimize=1, p=0)", () => {
    const full = dockShapes(0, REGION_W, 0, 0)
    const min = dockShapes(0, REGION_W, 0, 1)
    expect(full.left.width).toBeCloseTo(REGION_W - DOCK_H - DOCK_GAP)
    expect(min.left.x).toBe(0)
    expect(min.left.width).toBeCloseTo(DOCK_H)
    expect(min.left.height).toBeCloseTo(DOCK_H)
  })

  it("leaves the detached search orb (right shape) EXACTLY where it is when minimizing", () => {
    const full = dockShapes(0, REGION_W, 0, 0)
    const min = dockShapes(0, REGION_W, 0, 1)
    expect(min.right).toEqual(full.right)
    expect(min.right.width).toBeCloseTo(DOCK_H)
    expect(min.right.x + min.right.width).toBeCloseTo(REGION_W)
  })

  it("interpolates the left width monotonically from wide capsule to H circle over minimize", () => {
    const widths = [0, 0.25, 0.5, 0.75, 1].map((m) => dockShapes(0, REGION_W, 0, m).left.width)
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]!).toBeLessThanOrEqual(widths[i - 1]! + 1e-9)
    }
    expect(widths[0]!).toBeCloseTo(REGION_W - DOCK_H - DOCK_GAP)
    expect(widths[widths.length - 1]!).toBeCloseTo(DOCK_H)
    expect(dockShapes(0, REGION_W, 0, 0.5).left.width).toBeCloseTo((REGION_W - DOCK_H - DOCK_GAP + DOCK_H) / 2)
  })

  it("is a NO-OP once the search morph is underway (p=1 already collapses the left shape to H)", () => {
    expect(dockShapes(1, REGION_W, 0, 0).left).toEqual(dockShapes(1, REGION_W, 0, 1).left)
    expect(dockShapes(1, REGION_W, 0, 1)).toEqual(dockShapes(1, REGION_W, 0, 0))
  })

  it("clamps minimize like progress + focus", () => {
    expect(dockShapes(0, REGION_W, 0, 1.5)).toEqual(dockShapes(0, REGION_W, 0, 1))
    expect(dockShapes(0, REGION_W, 0, -0.5)).toEqual(dockShapes(0, REGION_W, 0, 0))
  })

  it("keeps the minimized circle vertically centered on H/2 (no squash bulge at p=0)", () => {
    const min = dockShapes(0, REGION_W, 0, 1)
    expect(min.left.height).toBeCloseTo(DOCK_H)
    expect(min.left.y + min.left.height / 2).toBeCloseTo(DOCK_H / 2)
  })
})

describe("dockRadius (constant, never animates)", () => {
  it("is H/2 regardless of progress (the caller never re-derives it from p)", () => {
    expect(dockRadius()).toBeCloseTo(DOCK_H / 2)
  })
})

describe("MIN_K (smin blend distance, pinned tiny to kill the blob-neck)", () => {
  it("is a tiny positive constant (hard min union, no neck, no divide-by-zero in smin)", () => {
    expect(MIN_K).toBeGreaterThan(0)
    expect(MIN_K).toBeLessThan(1)
  })
  it("is what the dock hands the shader at EVERY progress (no mid-morph swell)", () => {
    const source = readFileSync(new URL("../LiquidGlassDock.native.tsx", import.meta.url), "utf8")
    expect(source).toMatch(/morphUniforms\(s, dockRadius\(\), MIN_K\)/)
    expect(source.match(/morphUniforms\(/g)).toHaveLength(1)
  })
})

describe("morphUniforms (flat SkSL uniforms for the three-box union)", () => {
  it("assembles the left + right + ✕ boxes + radius + k (no Skia types)", () => {
    const shapes = dockShapes(1, REGION_W, 1)
    const u = morphUniforms(shapes, dockRadius(), MIN_K)
    expect(u.leftBox).toEqual([shapes.left.x, shapes.left.y, shapes.left.width, shapes.left.height])
    expect(u.rightBox).toEqual([shapes.right.x, shapes.right.y, shapes.right.width, shapes.right.height])
    expect(u.clearBox).toEqual([shapes.clear.x, shapes.clear.y, shapes.clear.width, shapes.clear.height])
    expect(u.radius).toBeCloseTo(DOCK_H / 2)
    expect(u.k).toBe(MIN_K)
  })
})

describe("lerp / smoothstep helpers", () => {
  it("lerp interpolates a..b by t", () => {
    expect(lerp(0, 10, 20)).toBe(10)
    expect(lerp(1, 10, 20)).toBe(20)
    expect(lerp(0.5, 10, 20)).toBe(15)
  })
  it("smoothstep is the hermite ramp, clamped", () => {
    expect(smoothstep(0, 1, -1)).toBe(0)
    expect(smoothstep(0, 1, 2)).toBe(1)
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5)
  })
})

describe("parseRgba (theme color string -> normalized vec4 for shader uniforms)", () => {
  it("parses rgba() strings", () => {
    expect(parseRgba("rgba(251,247,240,0.62)")).toEqual([251 / 255, 247 / 255, 240 / 255, 0.62])
  })
  it("parses rgb() strings with alpha 1", () => {
    expect(parseRgba("rgb(255, 255, 255)")).toEqual([1, 1, 1, 1])
  })
  it("parses #hex strings", () => {
    expect(parseRgba("#ff0000")).toEqual([1, 0, 0, 1])
  })
  it("falls back to transparent white on garbage", () => {
    expect(parseRgba("not-a-color")).toEqual([1, 1, 1, 0])
  })
})
