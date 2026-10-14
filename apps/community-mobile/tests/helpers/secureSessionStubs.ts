// Stand-ins for the native token store and the API client, for tests that exercise the real
// src/auth/storage.ts: each keychain write and each session request settles only when the test says so.

export interface Pending {
  release: () => void
}

export const keychain = new Map<string, string>()

export const pendingWrites: Pending[] = []

export const control: {
  session: (signal: AbortSignal | undefined) => Promise<unknown>
} = {
  session: async () => ({ authenticated: false }),
}

export const AFTER_FIRST_UNLOCK = 0

export async function getItemAsync(key: string): Promise<string | null> {
  return keychain.get(key) ?? null
}

export function setItemAsync(key: string, value: string): Promise<void> {
  return new Promise((resolve) => {
    pendingWrites.push({
      release: () => {
        keychain.set(key, value)
        resolve()
      },
    })
  })
}

export function deleteItemAsync(key: string): Promise<void> {
  return new Promise((resolve) => {
    pendingWrites.push({
      release: () => {
        keychain.delete(key)
        resolve()
      },
    })
  })
}

export const storage = {
  getString: (): string | undefined => undefined,
  set: (): void => undefined,
  delete: (): void => undefined,
}

export const API_URL = "https://api.civfix.org"

export const api = {
  session: (options: { signal?: AbortSignal }) => control.session(options.signal),
}
