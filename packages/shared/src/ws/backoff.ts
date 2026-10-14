/**
 * Exponential backoff with full jitter for WebSocket reconnects, shared by the web and mobile WS clients.
 * FULL JITTER (a uniform point in `[0, min(capMs, baseMs * 2 ** attempt)]`) spreads reconnects across
 * clients and avoids a thundering herd.
 */

export interface BackoffOptions {
  /** Initial backoff in ms (the attempt-0 ceiling before jitter). Default 1000. */
  baseMs?: number
  /** Maximum backoff in ms (the exponential is clamped to this before jitter). Default 15000. */
  capMs?: number
  /** Uniform random in [0, 1). Defaults to Math.random; inject a seeded one for deterministic tests. */
  jitter?: () => number
}

const DEFAULT_BASE_MS = 1000
const DEFAULT_CAP_MS = 15000

/**
 * Next reconnect delay in ms for a 0-based `attempt` number, using exponential backoff with full
 * jitter. Negative or non-finite attempts are treated as 0. The returned value is always in
 * `[0, min(capMs, baseMs * 2 ** attempt)]`.
 */
export function nextBackoffMs(attempt: number, opts: BackoffOptions = {}): number {
  const baseMs = opts.baseMs ?? DEFAULT_BASE_MS
  const capMs = opts.capMs ?? DEFAULT_CAP_MS
  const rand = opts.jitter ?? Math.random

  const safeAttempt = Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 0
  // 2 ** large overflows to Infinity; Math.min with capMs clamps it safely.
  const exp = baseMs * 2 ** safeAttempt
  const capped = Math.min(capMs, exp)
  return rand() * capped
}
