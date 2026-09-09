/**
 * Pure vertical-layout solver for MessageContextMenu's native variant (P1 Task 1.4). The menu is an
 * iMessage/Telegram-style takeover: the pressed bubble is re-rendered at its measured window position,
 * a reaction row floats ABOVE it, and the action card sits BELOW it. This module owns the flip/clamp
 * math so it unit-tests without React (package convention: pure-logic vitest); the component is a thin
 * renderer over the returned bands.
 *
 * Rules (mirroring PopoverMenu's clamp style):
 *   - Default: reactions above the bubble, action card below (`flipped: false`).
 *   - When the card would overflow the bottom edge margin, it FLIPS above the reaction row
 *     (`flipped: true`), so the stack reads card / reactions / bubble top-to-bottom.
 *   - The stack is then shifted/clamped so no band starts above the top edge margin: an unflipped
 *     stack whose reaction row would clip the top shifts DOWN whole (gaps preserved); a flipped stack
 *     whose card would clip the top shifts down only as far as the bubble can go without crossing the
 *     bottom margin, then hard-clamps. Tops are therefore NEVER negative, even on absurdly small
 *     windows (bands may overlap there - showing something beats clipping everything).
 */

/** A measured screen rect (the `measureInWindow` shape PopoverMenu's AnchorRect uses). */
export interface MenuAnchorRect {
  x: number
  y: number
  width: number
  height: number
}

/** The resolved vertical bands (absolute window `top` values) + which way the card went. */
export interface MenuPlacement {
  /** Top of the re-rendered bubble (the anchor's own y unless the stack had to shift). */
  bubbleTop: number
  /** Top of the reaction glyph row (always above the bubble). */
  reactionsTop: number
  /** Top of the action card (below the bubble, or above the reactions when flipped). */
  menuTop: number
  /** True when the action card flipped above (anchor near the bottom edge). */
  flipped: boolean
}

/** Gap between the bubble and each floating band (reaction row / action card). */
export const CONTEXT_MENU_GAP = 8
/** Minimum margin every band keeps from the top/bottom screen edges. */
export const CONTEXT_MENU_EDGE_MARGIN = 12

export interface MenuPlacementOptions {
  /** Override the band gap (defaults to CONTEXT_MENU_GAP). */
  gap?: number
  /** Override the screen-edge margin (defaults to CONTEXT_MENU_EDGE_MARGIN). */
  edgeMargin?: number
}

/**
 * Solve the vertical placement of the bubble / reaction row / action card for one open menu.
 *
 * @param anchor        The pressed bubble's measured window rect.
 * @param screenH       Window height (useWindowDimensions().height).
 * @param menuH         The action card's (estimated) height.
 * @param reactionRowH  The reaction row's (estimated) height.
 */
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
  // Flip when the card cannot fit below the bubble inside the bottom edge margin.
  const flipped = anchor.y + bubbleH + gap + menuH > screenH - edge

  let bubbleTop = anchor.y
  let reactionsTop = bubbleTop - gap - reactionRowH
  let menuTop: number

  if (!flipped) {
    menuTop = bubbleTop + bubbleH + gap
    // Anchor near the very top: the reaction row would clip - shift the WHOLE stack down so the row
    // sits on the edge margin (gaps preserved; the bottom fit was already proven by !flipped only for
    // the unshifted position, but a top-clipped anchor is by definition high on screen).
    if (reactionsTop < edge) {
      const shift = edge - reactionsTop
      reactionsTop += shift
      bubbleTop += shift
      menuTop += shift
    }
  } else {
    // Flipped: card above the reaction row (stack: card / reactions / bubble).
    menuTop = reactionsTop - gap - menuH
    // Card clipped at the top (tall card / short screen): shift the stack down, but never push the
    // bubble past the bottom edge margin; whatever cannot be absorbed is hard-clamped below.
    if (menuTop < edge) {
      const room = Math.max(0, screenH - edge - (bubbleTop + bubbleH))
      const shift = Math.min(edge - menuTop, room)
      menuTop += shift
      reactionsTop += shift
      bubbleTop += shift
    }
  }

  // Hard floor: no band ever starts above the edge margin (=> never negative), even when the window
  // is too small to honor the gaps. Overlap on such windows is the accepted degradation.
  return {
    bubbleTop: Math.max(edge, bubbleTop),
    reactionsTop: Math.max(edge, reactionsTop),
    menuTop: Math.max(edge, menuTop),
    flipped,
  }
}

/**
 * Clamp a floating band's `left` so a card of `width` stays inside the window, aligned to the
 * bubble's leading or trailing edge (`alignRight` = the viewer's own right-aligned bubble). Same
 * math as PopoverMenu's horizontal clamp, extracted so both bands share it.
 */
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
