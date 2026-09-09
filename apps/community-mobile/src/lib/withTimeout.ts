/**
 * ONE promise timeout, and ONE device-fix cap, shared by everything in this app that waits on
 * expo-location.
 *
 * `Location.getCurrentPositionAsync` has no timeout of its own and a first Balanced fix can hang for many
 * seconds (worst right after launch / indoors / on a simulator). Both callers - the map home's
 * `useUserLocation` and the `GeolocationCapability` the shared @civfix/ui bodies resolve their position
 * through - therefore have to cap it and fall back. They used to disagree about that: only the hook had a
 * cap, so every @civfix/ui surface (Discovery's jurisdiction + nearby reports, the sidebar's events)
 * waited on an uncapped fix and, with the shared query's `retry: false` + infinite staleTime, ONE hang was
 * permanent for the session. Extracted here so the two cannot drift again.
 *
 * The cap has a TWIN, for the same reason: `LAST_KNOWN_MAX_AGE_MS` below. Every one of these callers takes
 * the OS's cached fix first and only pays for a fresh one when there is none, so "how long may we wait" is
 * only half the policy - "how old may the cheap answer be" is the other half, and it has the same
 * one-stale-read-poisons-the-session blast radius. Both constants live here so no caller can hold one
 * without the other.
 */

/**
 * Cap how long we wait on a FRESH device GPS fix before giving up, so the caller can fall back (to the
 * last known fix, or to IP geolocation).
 */
export const GPS_TIMEOUT_MS = 4000

/**
 * Cap how OLD a CACHED device fix may be before we stop treating it as "where the user is".
 *
 * The cheap half of every read below is `Location.getLastKnownPositionAsync()`, and called with NO options
 * it returns whatever the OS still holds - which is unbounded in age on both platforms (iOS
 * `CLLocationManager.location`; Android's device-wide fused `getLastLocation()`), so it can be hours or days
 * old and from a different city. That is not a harmless staleness here: the fix these callers resolve is
 * written into the shared `queryKeys.userLocation` cache with an INFINITE staleTime and `retry: false`, so a
 * single stale read names the wrong jurisdiction, ranks the wrong leaderboard, lists the wrong "nearby
 * reports" and opens the report wizard's pin-drop map in the wrong city FOR THE WHOLE SESSION. Fly from LA
 * to Chicago, open the app before the OS refreshes its own cache, and that is exactly what happens.
 *
 * 60s is the bound the in-viewfinder GPS chip has used since it was written, and it keeps the cached read as
 * what it is meant to be - an INSTANT path to a fix the user actually holds - rather than a substitute for
 * one. With nothing that fresh, callers fall through to the GPS_TIMEOUT_MS-capped fresh read and then to
 * their own IP fallback, which is the intended degradation ladder: bounding this never leaves a caller with
 * no location, it only stops it settling for a wrong one.
 */
export const LAST_KNOWN_MAX_AGE_MS = 60_000

/** Resolve to the promise's value, or to null if it rejects or does not settle within `ms`. */
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
