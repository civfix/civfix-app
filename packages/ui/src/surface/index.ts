// @civfix/ui/surface barrel - the platform-split BlurSurface glass primitive.
// The bare `./BlurSurface` specifier resolves to the .native / .web seam at bundle time, and to the
// platform-agnostic default under tsc (see BlurSurface.tsx).
export { BlurSurface } from "./BlurSurface"
export type { BlurSurfaceProps, GlassKind } from "./types"

// Liquid-glass dock primitive (native Skia SDF morph / web BlurSurface) + its pure morph model.
export {
  LiquidGlassDock,
  dockShapes,
  dockRadius,
  morphK,
  morphUniforms,
  parseRgba,
  lerp,
  clamp01,
  smoothstep,
  DOCK_H,
  DOCK_GAP,
  DOCK_MORPH_SHRINK,
  DOCK_MORPH_TOP_OFFSET,
} from "./liquidGlass"
export type {
  LiquidGlassDockProps,
  DockShapes,
  MorphUniforms,
  Rect,
} from "./liquidGlass"
