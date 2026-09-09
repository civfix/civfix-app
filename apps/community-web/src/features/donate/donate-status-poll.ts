import type { DonationStatus } from "@civfix/shared"

export const POLL_GIVE_UP_MS = 30_000

const BASE_DELAY_MS = 1_000
const MAX_DELAY_MS = 5_000

export function isTerminalDonationStatus(status: DonationStatus): boolean {
  return status !== "pending"
}

export function nextPollDelayMs(attempt: number): number {
  const bounded = Math.max(0, Math.floor(attempt))
  return Math.min(BASE_DELAY_MS * 2 ** bounded, MAX_DELAY_MS)
}

export function elapsedAfterAttempts(attempts: number): number {
  let total = 0
  for (let index = 0; index < attempts; index += 1) total += nextPollDelayMs(index)
  return total
}

export type PollDecision =
  | { readonly kind: "stop"; readonly reason: "settled" }
  | { readonly kind: "stop"; readonly reason: "timed_out" }
  | { readonly kind: "wait"; readonly delayMs: number }

export function pollDecision(
  status: DonationStatus | null,
  attempt: number,
  elapsedMs: number,
): PollDecision {
  if (status !== null && isTerminalDonationStatus(status)) return { kind: "stop", reason: "settled" }
  const delayMs = nextPollDelayMs(attempt)
  if (elapsedMs + delayMs > POLL_GIVE_UP_MS) return { kind: "stop", reason: "timed_out" }
  return { kind: "wait", delayMs }
}
