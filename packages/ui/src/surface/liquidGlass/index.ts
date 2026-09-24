// Never export glassShaders from here: it imports Skia at module scope, and this barrel reaches web.
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
