/**
 * Pure math for the liquid-glass dock morph (no Skia, no react-native imports).
 *
 * The dock is two glass shapes on one track: the left tab capsule becomes the exit circle, and the right
 * search orb becomes the search field. The morph is a mirrored width swap over progress p in [0,1]:
 *   leftW  = mix(p, WIDE, H)
 *   rightW = mix(p, H, WIDE)
 * with WIDE = T - H - G, so leftW + rightW = T - G and the gap stays the constant G at every progress.
 * The corner radius is a constant H/2, so at p=1 the left shape is exactly a circle. A small squash
 * (H - 2*sin(p*pi) on the capsule, H + 2*sin(p*pi) on the field) gives the mass-transfer read.
 *
 * Every function carries a 'worklet' directive so reanimated can run it on the UI thread; the directive is
 * inert under node, which keeps this file unit-testable.
 */

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface DockShapes {
  left: Rect
  right: Rect
  /** The trailing dismiss (X) circle, parked off the right edge (never drawn) until focus slides it in. */
  clear: Rect
}

export interface MorphUniforms {
  leftBox: [number, number, number, number]
  rightBox: [number, number, number, number]
  clearBox: [number, number, number, number]
  radius: number
  k: number
}

export const DOCK_H = 64
export const DOCK_GAP = 12
/**
 * The morphed shapes slim from DOCK_H to 48 at p=1 (the slim system search bar). They stay top-aligned,
 * so the freed height comes off the bottom of the band.
 */
export const DOCK_MORPH_SHRINK = 16
/** 2pt rather than flush so the slim bar reads aligned with, not fused to, the resting navbar's top edge. */
export const DOCK_MORPH_TOP_OFFSET = 2

export function clamp01(v: number): number {
  "worklet"
  return v < 0 ? 0 : v > 1 ? 1 : v
}

export function lerp(t: number, a: number, b: number): number {
  "worklet"
  return a + (b - a) * t
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  "worklet"
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/** The literal default must equal DOCK_H: a worklet cannot capture a module const in its parameter list. */
export function dockRadius(h: number = 64): number {
  "worklet"
  return h / 2
}

/**
 * `minimize` (the scroll-down collapse) shrinks only the left shape's rest width to an H circle and leaves
 * the search orb in place, so unlike the width swap it does not keep leftW + rightW = T - G. It is a no-op
 * once the morph is underway, and callers pass 0 during Search so the field is never clipped.
 *
 * The worklet defaults are literals (64/12) that must equal DOCK_H / DOCK_GAP: reanimated does not capture
 * a module const referenced in a worklet's default parameter list (it throws "Property 'DOCK_H' doesn't
 * exist" on the UI thread).
 */
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
  // The literal 16 must equal DOCK_MORPH_SHRINK, for the same worklet-capture reason as the defaults.
  const u = lerp(p, h, h - 16)
  const wide = Math.max(regionW - u - gap, 0)
  const restLeftW = lerp(m, wide, u)
  const leftWp = lerp(p, restLeftW, u)
  const rightWp = lerp(p, u, wide)
  const bulge = 2 * Math.sin(p * Math.PI)
  // The literal 2 must equal DOCK_MORPH_TOP_OFFSET. All three shapes share one centerline.
  const yTop = lerp(p, 0, 2)
  const cy = yTop + u / 2
  const leftH = u - bulge
  const rightH = u + bulge
  // Focus (only meaningful at p=1) never touches the leading circle: the field shrinks from its right edge
  // to make room for the separate dismiss circle, and every gap stays G.
  const leftW = leftWp
  const fieldFocusW = Math.max(wide - u - gap, 0)
  const rightW = lerp(f, rightWp, fieldFocusW)
  const rightX = lerp(f, regionW - rightWp, u + gap)
  const clearX = lerp(f, regionW + gap, regionW - u)
  return {
    left: { x: 0, y: cy - leftH / 2, width: leftW, height: leftH },
    right: { x: rightX, y: cy - rightH / 2, width: rightW, height: rightH },
    clear: { x: clearX, y: cy - u / 2, width: u, height: u },
  }
}

/**
 * The smin blend distance, the same at every progress: the system tab-bar to search morph never shows
 * merged blobs, so the smin degenerates to a hard min() union with no neck. It stays above 0 because k=0
 * divides by zero in smin and the border/specular pass needs a well-defined zero contour.
 */
export const MIN_K = 0.01

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

/** Unknown formats fall back to transparent white, so a bad theme value draws nothing. */
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
