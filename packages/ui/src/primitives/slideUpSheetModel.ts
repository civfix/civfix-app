export const SLIDE_UP_DISMISS_DISTANCE = 96
export const SLIDE_UP_DISMISS_VELOCITY = 0.9
const SLIDE_UP_CAPTURE_SLOP = 4

export type SlideUpDragOutcome = "dismiss" | "settle"

export function slideUpShouldCapture(dx: number, dy: number): boolean {
  return dy > SLIDE_UP_CAPTURE_SLOP && Math.abs(dy) > Math.abs(dx)
}

export function slideUpDragOffset(dy: number): number {
  return Math.max(0, dy)
}

export function slideUpDragOutcome(dy: number, vy: number, sheetHeight: number | null): SlideUpDragOutcome {
  if (dy <= 0) return "settle"
  if (vy >= SLIDE_UP_DISMISS_VELOCITY) return "dismiss"
  const threshold =
    sheetHeight !== null && sheetHeight > 0
      ? Math.min(SLIDE_UP_DISMISS_DISTANCE, sheetHeight / 2)
      : SLIDE_UP_DISMISS_DISTANCE
  return dy >= threshold ? "dismiss" : "settle"
}

export function slideUpSheetMaxHeight(
  windowHeight: number,
  ratio: number,
  keyboardLift: number,
  topInset: number = 0,
): number {
  if (keyboardLift <= 0) return windowHeight * ratio
  return Math.min(windowHeight * ratio, windowHeight - keyboardLift - topInset)
}
