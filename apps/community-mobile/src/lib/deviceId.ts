/**
 * Stable per-install device identifier for push-token registration.
 *
 * WHY: the backend `push_tokens` upsert carries an OWNERSHIP-STEAL guard (P1-3) — an Expo push token,
 * which is stable per app-install (the SAME string regardless of which account is signed in), is only
 * (re)assigned to the registering user when that user already owns it OR presents the SAME non-null
 * `device_id` as proof of genuine same-device handoff. Without a device id every account after the FIRST
 * one signed in on a device hits the guard, the upsert returns "conflict", and that account gets NO
 * push-token row. Sending a stable device id lets the guard transfer the token to whoever is currently
 * signed in on the device, which is the correct behaviour.
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
    // registration still proceeds — same as the pre-fix behaviour, just without same-device handoff.
    return null
  }
}
