import { K_SUPPRESS, normalizeK, roundRate, safeCount } from "./counts.js"

export { K_SUPPRESS }

export interface SuppressedCount {
  suppressed: boolean
  value: number | null
}

export type SuppressedRatio = SuppressedCount

export function suppressCount(count: number, k: number = K_SUPPRESS): SuppressedCount {
  const threshold = normalizeK(k)
  const safe = safeCount(count)
  const suppressed = safe < threshold
  return { suppressed, value: suppressed ? null : safe }
}

export function suppressRate(
  numerator: number,
  denominator: number,
  k: number = K_SUPPRESS,
): SuppressedRatio {
  const threshold = normalizeK(k)
  const den = safeCount(denominator)
  const num = safeCount(numerator)
  if (den < threshold) return { suppressed: true, value: null }
  const bounded = Math.min(num, den)
  return { suppressed: false, value: roundRate(bounded / den) }
}
