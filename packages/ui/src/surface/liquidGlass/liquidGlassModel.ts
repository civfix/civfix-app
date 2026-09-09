/**
 * liquidGlassModel - PURE math for the liquid-glass dock morph (no Skia, no react-native imports).
 *
 * The dock is TWO floating glass shapes on one horizontal track (outer margin owned by the caller):
 *   - LEFT shape:  the tab capsule (rest) -> the exit circle (docked). Left-anchored (x = 0).
 *   - RIGHT shape: the search orb (rest) -> the search field (docked). Right-anchored (right edge = T).
 *
 * The morph is a MIRRORED WIDTH SWAP driven by a single progress p in [0,1]:
 *   leftW  = mix(p, WIDE, H)   (wide capsule  -> H-wide circle)
 *   rightW = mix(p, H, WIDE)   (H-wide orb    -> wide field)
 * with WIDE = T - H - G. Because leftW + rightW = T - G for ALL p, the gap between the two shapes is
 * the CONSTANT G at every progress - the two ends slide past each other without ever overlapping or
 * separating. The corner radius is CONSTANT H/2 (never animates); only the WIDTHS (and a small squash)
 * change, so at p=1 the left shape is exactly a circle and the right shape is a full pill.
 *
 * A squash gives the mass-transfer read: the shrinking capsule SQUASHES (H - 2·sin(pπ)) while the
 * growing field BULGES (H + 2·sin(pπ)); both return to H at the endpoints.
 *
 * The Skia layer unions the two rounded boxes with a smooth-min whose k swells mid-morph
 * (16 -> 32 -> 16); calibrated to the G=12 gap, the smin bridges the gap ONLY mid-morph (the liquid
 * neck) and reads as two separate shapes at the endpoints.
 *
 * Every function carries a 'worklet' directive so reanimated can call it on the UI thread from
 * `useDerivedValue` / `useAnimatedStyle`; the directive is inert under node/vitest, which keeps this
 * file unit-testable with zero native deps.
 */

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** The dock shapes at a given progress + focus (local dock-region coordinates). */
export interface DockShapes {
  /** Tab capsule -> exit circle (left-anchored). The LEADING circle is preserved through focus. */
  left: Rect
  /** Search orb -> search field. Right-anchored while docked; shrinks from its right edge on focus. */
  right: Rect
  /**
   * The trailing ✕ (dismiss) circle. Parked OFF the right edge while unfocused (never drawn) and slides
   * in to (regionW - h) on focus, so the focused bar reads as three shapes: [circle | field | ✕ circle]
   * (Apple-Music / News). h-wide, right-anchored at full focus.
   */
  clear: Rect
}

/** Flat numeric uniforms for the liquid-material SkSL effect (see glassShaders.ts). */
export interface MorphUniforms {
  leftBox: [number, number, number, number]
  rightBox: [number, number, number, number]
  clearBox: [number, number, number, number]
  radius: number
  k: number
}

/** Dock height (pt) - the resting shapes' height and the tab-band height (radius = height/2). */
export const DOCK_H = 64
/** Constant gap (pt) between the two shapes at every progress. */
export const DOCK_GAP = 12
/** Peak height overshoot (pt) of the squash/bulge at mid-morph. */
export const SQUASH = 2
/**
 * Total vertical/diameter SHRINK (pt) the morphed shapes take within the dock band as the search morph
 * completes: the exit circle, the search field and the ✕ circle slim to DOCK_H - 16 = 48 at p=1 (Apple's
 * slim search bar). Unlike the earlier centered slimming, the slimmed shapes are TOP-ALIGNED: their top
 * edge holds nearly in line with the resting navbar's top (see DOCK_MORPH_TOP_OFFSET), so the freed
 * height comes off the BOTTOM of the band and the docked centerline sits at ~26, not 32.
 */
export const DOCK_MORPH_SHRINK = 16
/**
 * Vertical offset (pt) of the slimmed shapes' TOP edge below the resting band top at p=1. A hair (2pt)
 * below rather than dead-flush so the slim bar reads optically aligned with (not fused to) where the
 * resting navbar's top edge was. The docked centerline is therefore TOP_OFFSET + (DOCK_H - SHRINK)/2 = 26.
 */
export const DOCK_MORPH_TOP_OFFSET = 2

export function clamp01(v: number): number {
  "worklet"
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/** Linear interpolate a..b by t (t already in [0,1]). */
export function lerp(t: number, a: number, b: number): number {
  "worklet"
  return a + (b - a) * t
}

/** GLSL-style smoothstep (hermite). */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  "worklet"
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/** Constant corner radius of both shapes (never animates). Literal default (must equal DOCK_H) so the
 * reanimated worklet needs no captured module const in its parameter list. */
export function dockRadius(h: number = 64): number {
  "worklet"
  return h / 2
}

/**
 * The two shape frames at progress p, in the dock region's LOCAL coordinate space (x in [0, regionW]).
 * The region is assumed to already carry the outer margin, so the shapes span the full region width.
 *
 * MINIMIZE (round 3, Apple-Music `.onScrollDown`): an independent `minimize` 0..1 collapses the LEFT shape's
 * REST width from the wide tab capsule down to an H circle at the leading margin, WITHOUT touching the right
 * shape (the detached search orb stays exactly where it is - the two are not tied by the width-swap while
 * minimizing). It only affects the rest end (p=0): the search morph already drives the left shape to an H
 * circle at p=1, so `minimize` folds in as the rest anchor (leftW at p=0 = mix(minimize, wide, H)) and is a
 * no-op once the morph is underway. Callers suppress it during Search (pass 0) so the field is never
 * clipped. Unlike the width-swap, minimizing does NOT preserve leftW+rightW = T-G (the leading circle and
 * the trailing orb sit apart with a wide gap - matching the system's minimized bar).
 */
// NOTE: worklet functions below take LITERAL numeric defaults (64/12/2), NOT the DOCK_* module consts,
// because reanimated does not capture a module const referenced in a worklet's DEFAULT PARAMETER list
// (it would throw "Property 'DOCK_H' doesn't exist" on the UI thread). The literals MUST equal DOCK_H /
// DOCK_GAP / SQUASH; the exported consts remain the single source for JS-thread callers + the tests.
export function dockShapes(
  progress: number,
  regionW: number,
  focus: number = 0,
  minimize: number = 0,
  h: number = 64,
  gap: number = 12,
): DockShapes {
  "worklet"
  const p = clamp01(progress)
  const f = clamp01(focus)
  const m = clamp01(minimize)
  // The per-progress "unit" size u: the docked circle diameter AND the shapes' height. The search morph
  // slims the shapes from the full band h down to h - DOCK_MORPH_SHRINK (64 -> 48) at p=1 — Apple's slim
  // search bar. The LITERAL 16 must equal DOCK_MORPH_SHRINK (worklets cannot capture a module const
  // referenced in scope-hostile positions; keep the literal in sync with the exported const).
  const u = lerp(p, h, h - 16)
  const wide = Math.max(regionW - u - gap, 0)
  // Progress width-swap: rest(0) = [wide capsule | u orb], docked(1) = [u circle | wide field]. The REST
  // anchor of the left shape is pulled toward a u circle by `minimize` (Apple-Music scroll-collapse), so
  // at p=0 leftW = mix(m, wide, u); the morph then still drives it to u at p=1 regardless of m.
  const restLeftW = lerp(m, wide, u)
  const leftWp = lerp(p, restLeftW, u)
  const rightWp = lerp(p, u, wide)
  const bulge = 2 * Math.sin(p * Math.PI)
  // Shapes are u tall (± the squash bulge) and TOP-ALIGNED as they slim: the shared band top eases from 0
  // (rest — shapes fill the band) to DOCK_MORPH_TOP_OFFSET (literal 2, must match the const) at p=1, so the
  // freed height comes off the BOTTOM and the slimmed top edge stays nearly in line with the resting
  // navbar's top. All three shapes ride ONE centerline cy = yTop + u/2 (32 at rest -> 26 docked); the
  // squash bulge distributes symmetrically about it. The constant corner radius clamps to u/2 in the
  // renderer, so the circles stay circular.
  const yTop = lerp(p, 0, 2)
  const cy = yTop + u / 2
  const leftH = u - bulge
  const rightH = u + bulge
  // FOCUS (Apple-Music / News, only meaningful at p≈1): the LEADING circle is PRESERVED (news-03 keeps the
  // app-glyph circle) - focus never touches the left shape. Instead the field shrinks from its RIGHT edge to
  // open room for a SEPARATE trailing ✕ circle that slides in from off the right edge. All the inter-shape
  // gaps stay the constant G. The squash bulge rides only the p-morph (bulge≈0 at p=1 where focus lives).
  const leftW = leftWp
  // Field: left edge pinned at (u+gap) once docked; width shrinks from `wide` to `wide - u - gap` on focus.
  const fieldFocusW = Math.max(wide - u - gap, 0)
  const rightW = lerp(f, rightWp, fieldFocusW)
  const rightX = lerp(f, regionW - rightWp, u + gap)
  // Trailing ✕ circle: parked at (regionW + gap) (off the right edge, unrendered) while unfocused; slides to
  // (regionW - u) at full focus. u-wide/tall, so at focus it is a crisp slim circle matching the leading one.
  const clearX = lerp(f, regionW + gap, regionW - u)
  return {
    left: { x: 0, y: cy - leftH / 2, width: leftW, height: leftH },
    right: { x: rightX, y: cy - rightH / 2, width: rightW, height: rightH },
    clear: { x: clearX, y: cy - u / 2, width: u, height: u },
  }
}

/**
 * The smin blend distance k for the union of the two rounded boxes.
 *
 * ROUND 6 (kill the blob-neck): the earlier schedule swelled k to 32 mid-morph so the smin BRIDGED the
 * 12pt gap with a liquid neck — but the system tab-bar↔search morph (Apple News / Music) NEVER shows
 * merged blobs: the two shapes stay crisp SEPARATE capsules with the constant gap through the whole
 * transition. So k is now pinned to a tiny floor (MIN_K) at EVERY progress: the smin degenerates to a
 * hard min() union (no meniscus, no bulging neck), yet stays strictly > 0 so the border/specular pass
 * still has a well-defined zero-contour to hug (a literal k=0 divides by zero in smin). The shapes read
 * as two separate rounded rects sliding past each other — matching the reference frames.
 */
export const MIN_K = 0.01
export function morphK(_progress: number): number {
  "worklet"
  return MIN_K
}

/** Assemble the flat SkSL uniforms for the two-box union at progress p. */
export function morphUniforms(shapes: DockShapes, radius: number, k: number): MorphUniforms {
  "worklet"
  const { left, right, clear } = shapes
  return {
    leftBox: [left.x, left.y, left.width, left.height],
    rightBox: [right.x, right.y, right.width, right.height],
    clearBox: [clear.x, clear.y, clear.width, clear.height],
    radius,
    k,
  }
}

/**
 * Parse a theme color string ("rgba(...)", "rgb(...)", "#rrggbb") into a normalized [r,g,b,a]
 * vec4 for shader uniforms. Unknown formats fall back to transparent white (draws nothing loud).
 */
export function parseRgba(color: string): [number, number, number, number] {
  "worklet"
  const rgba = color.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/)
  if (rgba) {
    return [
      Number(rgba[1]) / 255,
      Number(rgba[2]) / 255,
      Number(rgba[3]) / 255,
      rgba[4] === undefined ? 1 : Number(rgba[4]),
    ]
  }
  const hex = color.match(/^#([0-9a-fA-F]{6})$/)
  if (hex) {
    const n = parseInt(hex[1]!, 16)
    return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255, 1]
  }
  return [1, 1, 1, 0]
}
