/**
 * Exponential backoff with full jitter for WebSocket reconnects.
 *
 * This is the pure schedule helper extracted from the web and mobile WS clients (which keep their own
 * platform-specific socket lifecycle, URL building, auth, and app-state handling). Both clients import
 * only this function so the bug-prone "how long until the next retry" math is defined and tested once.
 *
 * Schedule: the uncapped exponential delay for `attempt` (0-based) is `baseMs * 2 ** attempt`, capped
 * at `capMs`. FULL JITTER then returns a uniform random point in `[0, cappedExp]`, which spreads
 * reconnects across clients and avoids a thundering herd. Defaults: base 1000 ms, cap 15000 ms (matching
 * the web client's existing schedule).
 *
 * Pure + deterministic when you inject `jitter` (a `() => number` in [0, 1), e.g. a seeded RNG in
 * tests). With the default `Math.random`, the result is in `[0, min(capMs, baseMs * 2 ** attempt)]`.
 */

export interface BackoffOptions {
  /** Initial backoff in ms (the attempt-0 ceiling before jitter). Default 1000. */
  baseMs?: number
  /** Maximum backoff in ms (the exponential is clamped to this before jitter). Default 15000. */
  capMs?: number
  /** Injectable uniform random in [0, 1). Defaults to Math.random. Inject for deterministic tests. */
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
  // 2 ** large overflows to Infinity; Math.min with capMs clamps it safely. Cap is also a lower bound
  // guard so a tiny base still cannot exceed the ceiling.
  const exp = baseMs * 2 ** safeAttempt
  const capped = Math.min(capMs, exp)
  return rand() * capped
}
