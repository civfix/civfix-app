// Never export glassShaders from here: it imports Skia at module scope, and this barrel reaches web.
export { LiquidGlassDock } from "./LiquidGlassDock"
export type { LiquidGlassDockProps } from "./LiquidGlassDock.types"
export {
  dockShapes,
  lerp,
  DOCK_H,
  DOCK_GAP,
  DOCK_MORPH_SHRINK,
} from "./liquidGlassModel"
export type { DockShapes } from "./liquidGlassModel"
