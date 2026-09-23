// expo-location's getCurrentPositionAsync has no timeout and a first fix can hang for many seconds; the
// resolved fix feeds a query cache with infinite staleTime and `retry: false`, so one hang lasts the session.
export const GPS_TIMEOUT_MS = 4000

export const FIRST_FIX_TIMEOUT_MS = 15_000

// getLastKnownPositionAsync with no options returns a fix of unbounded age, possibly from another city, and
// that fix lands in the same infinite-staleTime cache. 60s keeps the cached read an instant path only.
export const LAST_KNOWN_MAX_AGE_MS = 60_000

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
