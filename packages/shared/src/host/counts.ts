import { ANALYTICS_SUPPRESSION_K } from "../schemas/host/suppression.js"

// One privacy floor: client-side suppression and the analytics schema default must never drift apart.
export const K_SUPPRESS = ANALYTICS_SUPPRESSION_K

const RATE_PRECISION = 10000

export function normalizeK(k: number | undefined): number {
  if (k === undefined || !Number.isFinite(k) || k < 1) return K_SUPPRESS
  return Math.floor(k)
}

export function safeCount(count: number): number {
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
}

export function roundRate(ratio: number): number {
  return Math.round(ratio * RATE_PRECISION) / RATE_PRECISION
}
