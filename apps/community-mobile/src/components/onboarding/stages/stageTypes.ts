export interface StageProps {
  active: boolean
  reduceMotion: boolean
}

export const STAGE_ASPECT_RATIO = 0.92

// The shared pin art is 64 wide by 76 tall, so the tip sits this far below the head at any rendered size.
const PIN_ART_ASPECT = 76 / 64

export function pinHeightFor(size: number): number {
  return Math.round(size * PIN_ART_ASPECT)
}

export function noop(): void {}
