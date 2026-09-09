export const K_SUPPRESS = 5

export interface SuppressedCount {
  suppressed: boolean
  value: number | null
}

export interface SuppressedRatio {
  suppressed: boolean
  value: number | null
}

const RATE_PRECISION = 10000

function normalizeK(k: number): number {
  if (!Number.isFinite(k) || k < 1) return K_SUPPRESS
  return Math.floor(k)
}

export function suppressCount(count: number, k: number = K_SUPPRESS): SuppressedCount {
  const threshold = normalizeK(k)
  const safe = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
  const suppressed = safe < threshold
  return { suppressed, value: suppressed ? null : safe }
}

export function suppressRate(
  numerator: number,
  denominator: number,
  k: number = K_SUPPRESS,
): SuppressedRatio {
  const threshold = normalizeK(k)
  const den = Number.isFinite(denominator) && denominator > 0 ? Math.floor(denominator) : 0
  const num = Number.isFinite(numerator) && numerator > 0 ? Math.floor(numerator) : 0
  if (den < threshold) return { suppressed: true, value: null }
  const bounded = Math.min(num, den)
  return { suppressed: false, value: Math.round((bounded / den) * RATE_PRECISION) / RATE_PRECISION }
}
