/**
 * Resolves the promise's value, or `null` once `ms` passes or the promise rejects. It never rejects, so a
 * caller that treats "no answer" and "failed" alike needs no try/catch, and a value landing after the cap
 * cannot replace the `null` the caller already received.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((settle) => {
    const timer = setTimeout(() => settle(null), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        settle(value)
      },
      () => {
        clearTimeout(timer)
        settle(null)
      },
    )
  })
}
