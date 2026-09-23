/**
 * Stable per-install device identifier for push-token registration.
 *
 * The id is sent with every push registration and stored for diagnostics and bookkeeping only; it no
 * longer proves anything to the backend. The `push_tokens` upsert reclaims a row for the registering
 * user when that user already owns it or when the row was revoked by a sign-out — an Expo push token is
 * stable per app-install (the SAME string regardless of which account is signed in), so a row that is
 * still ACTIVE under another account is refused with "conflict".
 *
 * `resolveDeviceId` is the pure functional core (store + uuid generator injected) so it is unit-testable
 * without the native SecureStore/Crypto modules; `getDeviceId` (in src/push/register.ts) is the thin
 * SecureStore-backed adapter.
 */

/** SecureStore key holding the persisted device id (Keychain on iOS survives reinstall — stable). */
export const DEVICE_ID_KEY = "civfix.device_id"

/** Minimal persistence seam so the resolver can be tested without expo-secure-store. */
export interface DeviceIdStore {
  read(key: string): Promise<string | null>
  write(key: string, value: string): Promise<void>
}

export async function resolveDeviceId(
  store: DeviceIdStore,
  randomUUID: () => string,
): Promise<string | null> {
  try {
    const existing = await store.read(DEVICE_ID_KEY)
    if (existing !== null && existing.length > 0) return existing
    const fresh = randomUUID()
    await store.write(DEVICE_ID_KEY, fresh)
    return fresh
  } catch {
    // SecureStore unavailable (e.g. unsigned simulator with no Keychain): fall back to no device id so
    // registration still proceeds, just without the bookkeeping.
    return null
  }
}
