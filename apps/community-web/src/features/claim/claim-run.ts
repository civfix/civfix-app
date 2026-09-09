/**
 * Latest-only sequencing for the /claim page's POST /claim/report (pure, so it is unit-testable without
 * a DOM or a network).
 *
 * The claim runs from an effect, so a claim can still be in flight when the page's `?code=` changes (an
 * in-app navigation from a notification carrying a DIFFERENT code). Without sequencing, the OLD claim
 * resolves into the page state it no longer owns: it shows the previous report as "linked" under a URL
 * carrying the new code, clears the handoff, and parks the phase on "done" so the new code is never
 * attempted. Every attempt therefore runs behind a gate that only the LATEST attempt can pass.
 */

export type ClaimGate = {
  /**
   * Start an attempt and take ownership of the page state. Returns a predicate that is true only while
   * this attempt is still the latest - a later `begin()` or `abandon()` retires it for good.
   */
  begin: () => () => boolean
  /** Retire the in-flight attempt without starting a new one (the claim code changed under it). */
  abandon: () => void
}

export function createClaimGate(): ClaimGate {
  let current = 0
  return {
    begin() {
      const attempt = ++current
      return () => attempt === current
    },
    abandon() {
      current += 1
    },
  }
}

export type GuardedClaimArgs<TResult> = {
  /** The code this attempt claims. Captured here so a later code change cannot re-target it. */
  claimCode: string
  gate: ClaimGate
  claim: (claimCode: string) => Promise<TResult>
  /** Enter the "claiming" phase. Runs synchronously, before the request. */
  onStart: () => void
  /**
   * The claim SUCCEEDED on the server - run even when this attempt was superseded. The report is linked
   * whatever the page now shows, so the side effects that belong to the CODE (dropping its stored
   * handoff) must still happen; leaving them undone would make a later code-less /claim visit retry an
   * already-claimed code and stick on a CONFLICT error. Never touch page state here.
   */
  onClaimed?: (result: TResult, claimCode: string) => void
  onSuccess: (result: TResult) => void
  onError: (err: unknown) => void
}

/**
 * Run one claim attempt through `gate`. The result is applied ONLY while the attempt is still current:
 * a superseded attempt resolves (or rejects) silently, leaving the page on whatever the newer code set
 * up - which is what lets the auto-claim effect re-arm and actually attempt that newer code.
 */
export async function runGuardedClaim<TResult>({
  claimCode,
  gate,
  claim,
  onStart,
  onClaimed,
  onSuccess,
  onError,
}: GuardedClaimArgs<TResult>): Promise<void> {
  const isCurrent = gate.begin()
  onStart()
  try {
    const result = await claim(claimCode)
    onClaimed?.(result, claimCode)
    if (!isCurrent()) return
    onSuccess(result)
  } catch (err) {
    if (!isCurrent()) return
    onError(err)
  }
}
