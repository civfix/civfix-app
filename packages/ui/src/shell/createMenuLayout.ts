import type { CreateMenuAnchor } from "./createMenuStore"

export const CREATE_MENU_WIDTH = 236
export const CREATE_MENU_ROW_HEIGHT = 46
export const CREATE_MENU_PAD = 4
export const CREATE_MENU_GAP = 10
export const CREATE_MENU_MARGIN = 12
export const CREATE_MENU_NOTCH = 14
export const CREATE_MENU_Z_BELOW_DOCK = 62

export type CreateMenuSide = "above" | "below"

export interface CreateMenuPlacement {
  left: number
  top: number
  notchLeft: number
  side: CreateMenuSide
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

export function createMenuCardSize(itemCount: number): { width: number; height: number } {
  return {
    width: CREATE_MENU_WIDTH,
    height: itemCount * CREATE_MENU_ROW_HEIGHT + CREATE_MENU_PAD * 2,
  }
}

export function createMenuPlacement(
  anchor: CreateMenuAnchor,
  viewport: { width: number; height: number },
  card: { width: number; height: number },
): CreateMenuPlacement {
  const above = anchor.y - card.height - CREATE_MENU_GAP
  const fitsAbove = above >= CREATE_MENU_MARGIN
  const top = fitsAbove
    ? above
    : clamp(
        anchor.y + anchor.height + CREATE_MENU_GAP,
        CREATE_MENU_MARGIN,
        viewport.height - card.height - CREATE_MENU_MARGIN,
      )
  const left = clamp(
    anchor.x + anchor.width / 2 - card.width / 2,
    CREATE_MENU_MARGIN,
    viewport.width - card.width - CREATE_MENU_MARGIN,
  )
  const notchLeft = clamp(
    anchor.x + anchor.width / 2 - left - CREATE_MENU_NOTCH / 2,
    CREATE_MENU_NOTCH,
    card.width - CREATE_MENU_NOTCH * 2,
  )
  return { left, top, notchLeft, side: fitsAbove ? "above" : "below" }
}
