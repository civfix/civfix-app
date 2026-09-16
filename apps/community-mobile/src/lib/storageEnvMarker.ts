/**
 * Which environment the storage in this container was last written by, and whether a boot has to throw
 * it away. Dependency-free so `node --test` can exercise the decision without the native keychain.
 *
 * WHY THIS EXISTS. `storageScope.ts` namespaces every persisted id by API host - except production,
 * which deliberately keeps the legacy un-suffixed ids so existing App Store users are not signed out.
 * That asymmetry is exactly what leaves production exposed: a build that resolves prod reads the legacy
 * ids and cannot tell its OWN leftovers from a pre-namespacing TestFlight install's staging leftovers.
 * A TestFlight tester who upgrades to the App Store copy would send a staging JWT to prod and paint a
 * cached staging user while it is rejected.
 *
 * So every run records the environment it belongs to, and a production boot that finds a NON-production
 * marker purges the legacy ids before anything reads them. The marker lives in the keychain rather than
 * MMKV precisely because the keychain is where the dangerous leftover (the session token) survives an
 * app DELETE, so a delete-and-reinstall into the App Store copy is covered too.
 *
 * WHAT THIS CANNOT DETECT. The first upgrade off a build that predates the marker. There the marker is
 * absent, and an absent marker beside a legacy session token is genuinely ambiguous - it is equally a
 * long-standing App Store user whose session is legitimately theirs. Signing every one of those out is
 * the worse failure, so an absent marker KEEPS the state: that one upgrade still sends a staging token
 * to prod, gets a 401, and signs out after briefly painting the cached user. Every later environment
 * flip on that install is covered, because by then a marker exists.
 */

/** Keychain item holding the environment of the last run. Never namespaced - it has to outlive the flip. */
export const STORAGE_ENV_MARKER_KEY = "civfix.storage.env"

/** The marker value for the legacy (production) namespace, which is the empty string as an id suffix. */
export const PROD_STORAGE_ENV = "prod"

/** The legacy, un-namespaced ids a production build reads, and therefore the ones a purge clears. */
export const LEGACY_STORAGE_IDS = [
  "civfix.session.token",
  "civfix.app",
  "civfix.secure",
  "civfix.secure-blobs.key",
] as const

export function storageEnvFor(namespace: string): string {
  return namespace === "" ? PROD_STORAGE_ENV : namespace
}

/**
 * Does this boot have to purge the legacy ids? Only a PRODUCTION boot reads them, and only a marker
 * that names a different environment proves they belong to someone else.
 */
export function purgesLegacyStorage(namespace: string, marker: string | null): boolean {
  if (namespace !== "") return false
  if (marker === null || marker === "") return false
  return marker !== PROD_STORAGE_ENV
}
