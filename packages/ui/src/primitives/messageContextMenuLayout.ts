/**
 * Vertical layout for MessageContextMenu's native takeover: reactions above the bubble, action card below.
 * The card flips above the reaction row when it would overflow the bottom margin, the stack then shifts
 * down to clear the top margin, and every top is floored at the margin (bands may overlap on tiny windows).
 */

export interface MenuAnchorRect {
  x: number
  y: number
  width: number
  height: number
}

export interface MenuPlacement {
  bubbleTop: number
  reactionsTop: number
  menuTop: number
  flipped: boolean
}

export const CONTEXT_MENU_GAP = 8
export const CONTEXT_MENU_EDGE_MARGIN = 12

export interface MenuPlacementOptions {
  gap?: number
  edgeMargin?: number
}

export function resolveMenuPlacement(
  anchor: MenuAnchorRect,
  screenH: number,
  menuH: number,
  reactionRowH: number,
  options: MenuPlacementOptions = {},
): MenuPlacement {
  const gap = options.gap ?? CONTEXT_MENU_GAP
  const edge = options.edgeMargin ?? CONTEXT_MENU_EDGE_MARGIN

  const bubbleH = anchor.height
  const flipped = anchor.y + bubbleH + gap + menuH > screenH - edge

  let bubbleTop = anchor.y
  let reactionsTop = bubbleTop - gap - reactionRowH
  let menuTop: number

  if (!flipped) {
    menuTop = bubbleTop + bubbleH + gap
    // Shifting down cannot break the bottom fit: a top-clipped anchor is by definition high on screen.
    if (reactionsTop < edge) {
      const shift = edge - reactionsTop
      reactionsTop += shift
      bubbleTop += shift
      menuTop += shift
    }
  } else {
    menuTop = reactionsTop - gap - menuH
    // Never push the bubble past the bottom margin; whatever cannot be absorbed is hard-clamped below.
    if (menuTop < edge) {
      const room = Math.max(0, screenH - edge - (bubbleTop + bubbleH))
      const shift = Math.min(edge - menuTop, room)
      menuTop += shift
      reactionsTop += shift
      bubbleTop += shift
    }
  }

  // Overlapping bands on a window too small for the gaps beat clipping everything.
  return {
    bubbleTop: Math.max(edge, bubbleTop),
    reactionsTop: Math.max(edge, reactionsTop),
    menuTop: Math.max(edge, menuTop),
    flipped,
  }
}

/** `alignRight` aligns the band to the bubble's trailing edge (the viewer's own messages). */
export function resolveBandLeft(
  anchor: MenuAnchorRect,
  screenW: number,
  width: number,
  alignRight: boolean,
  options: MenuPlacementOptions = {},
): number {
  const edge = options.edgeMargin ?? CONTEXT_MENU_EDGE_MARGIN
  const rawLeft = alignRight ? anchor.x + anchor.width - width : anchor.x
  const maxLeft = Math.max(edge, screenW - width - edge)
  return Math.min(Math.max(rawLeft, edge), maxLeft)
}
