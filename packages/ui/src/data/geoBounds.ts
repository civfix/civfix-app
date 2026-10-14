export const MIN_LNG_COSINE = 0.01

export const PIN_SPAN_MAX_DEG = (360 * 8) / 2 ** 13

export function clampLat(n: number): number {
  return Math.max(-90, Math.min(90, n))
}

export function clampLng(n: number): number {
  return Math.max(-180, Math.min(180, n))
}
