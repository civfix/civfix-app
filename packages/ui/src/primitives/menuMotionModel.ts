import { MOTION } from "../theme/motion"

export const MENU_SCALE_FROM = MOTION.menuScaleFrom

export interface AnchorRect {
  x: number
  y: number
  width: number
  height: number
}

export interface MenuCardRect {
  left: number
  top: number
  width: number
  height: number
}

export interface MenuOrigin {
  originX: number
  originY: number
  translateX: number
  translateY: number
}

const CENTERED_ORIGIN: MenuOrigin = { originX: 0, originY: 0, translateX: 0, translateY: 0 }

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function menuOrigin(
  anchor: AnchorRect | null | undefined,
  card: MenuCardRect | null | undefined,
  scaleFrom: number = MENU_SCALE_FROM,
): MenuOrigin {
  if (!anchor || !card || card.width <= 0 || card.height <= 0) return CENTERED_ORIGIN
  const originX = clamp(anchor.x + anchor.width / 2 - card.left, 0, card.width)
  const originY = clamp(anchor.y + anchor.height / 2 - card.top, 0, card.height)
  const shrink = 1 - scaleFrom
  return {
    originX,
    originY,
    translateX: (originX - card.width / 2) * shrink,
    translateY: (originY - card.height / 2) * shrink,
  }
}
