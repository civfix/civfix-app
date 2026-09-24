/** How long a FRESH device fix gets before we stop waiting and fall back to IP. */
export const DEVICE_FIX_TIMEOUT_MS = 4000

/** Resolve to the promise's value, or to `null` if it rejects or does not settle within `ms`. */
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
