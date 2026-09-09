// @civfix/ui/surface/liquidGlass barrel - the liquid-glass dock primitive (Skia SDF morph on
// native, BlurSurface CSS glass on web) plus its pure, unit-tested morph model.
//
// The bare `./LiquidGlassDock` specifier resolves per platform (Metro -> .native.tsx with
// expo-blur + Skia; web bundlers/tsc -> .tsx with BlurSurface, zero Skia imports), mirroring the
// BlurSurface seam pattern. NEVER export glassShaders from here - it imports Skia at module scope
// and is native-only (imported solely by LiquidGlassDock.native.tsx).
export { LiquidGlassDock } from "./LiquidGlassDock"
export type { LiquidGlassDockProps } from "./LiquidGlassDock.types"
export {
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
} from "./liquidGlassModel"
export type { DockShapes, MorphUniforms, Rect } from "./liquidGlassModel"
