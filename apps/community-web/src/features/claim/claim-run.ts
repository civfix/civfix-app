/**
 * A claim can still be in flight when the page's `?code=` changes (an in-app navigation from a
 * notification carrying a different code). The old claim would then show its report as linked under the
 * new code's URL and park the phase on "done", so the new code is never attempted. Only the latest
 * attempt may write page state.
 */

export type ClaimGate = {
  /** The returned predicate stays true only until a later `begin()` or `abandon()`. */
  begin: () => () => boolean
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
  /** Captured here so a later code change cannot re-target the attempt. */
  claimCode: string
  gate: ClaimGate
  claim: (claimCode: string) => Promise<TResult>
  onStart: () => void
  /**
   * Runs even when the attempt was superseded: the report is linked whatever the page shows, and leaving
   * the code's stored handoff in place would make a later code-less /claim visit retry an already-claimed
   * code and stick on a CONFLICT error. Never touch page state here.
   */
  onClaimed?: (result: TResult, claimCode: string) => void
  onSuccess: (result: TResult) => void
  onError: (err: unknown) => void
}

/**
 * A superseded attempt resolves or rejects silently, leaving the page on whatever the newer code set up,
 * which is what lets the auto-claim effect re-arm and attempt that code.
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
