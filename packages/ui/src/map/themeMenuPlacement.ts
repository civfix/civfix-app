export const THEME_MENU_MAX_WIDTH = 248

export interface ThemeMenuPlacementInput {
  anchorRight: number | null
  viewportWidth: number
  margin: number
  maxWidth?: number
}

export interface ThemeMenuPlacement {
  width: number
  right: number
}

export interface ThemeMenuAnchorRect {
  x: number
  y: number
  width: number
  height: number
}

export interface ThemeMenuFrameInput {
  anchor: ThemeMenuAnchorRect
  viewportWidth: number
  margin: number
  gap: number
  maxWidth?: number
}

export interface ThemeMenuFrame {
  top: number
  right: number
  width: number
}

export function themeMenuFrame({
  anchor,
  viewportWidth,
  margin,
  gap,
  maxWidth,
}: ThemeMenuFrameInput): ThemeMenuFrame {
  const anchorRight = anchor.x + anchor.width
  const { width, right } = themeMenuPlacement({ anchorRight, viewportWidth, margin, maxWidth })
  return {
    top: anchor.y + anchor.height + gap,
    right: viewportWidth - anchorRight + right,
    width,
  }
}

export function themeMenuPlacement({
  anchorRight,
  viewportWidth,
  margin,
  maxWidth = THEME_MENU_MAX_WIDTH,
}: ThemeMenuPlacementInput): ThemeMenuPlacement {
  const width = Math.max(0, Math.min(maxWidth, viewportWidth - margin * 2))
  if (anchorRight === null) return { width, right: 0 }
  const rightEdge = Math.min(Math.max(anchorRight, margin + width), viewportWidth - margin)
  return { width, right: anchorRight - rightEdge }
}
