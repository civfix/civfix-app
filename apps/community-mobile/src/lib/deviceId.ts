// Diagnostics only; it proves nothing to the backend. An Expo push token is the same string for every
// account on an install, so the `push_tokens` upsert refuses a row still active under another account.
export const DEVICE_ID_KEY = "civfix.device_id"

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
    // An unsigned simulator has no Keychain; registration still proceeds without the id.
    return null
  }
}
