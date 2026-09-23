import * as SecureStore from "expo-secure-store"
import { storage } from "@/lib/mmkv"
import { scopeStorageId } from "@/lib/storageScope"
import { API_URL } from "@/config"

const TOKEN_KEY = scopeStorageId("civfix.session.token", API_URL)

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
}

export type TokenRead = { ok: true; token: string | null } | { ok: false }

function readDevFallback(): TokenRead {
  const fallback = storage.getString(TOKEN_KEY)
  return { ok: true, token: fallback ?? null }
}

export async function readToken(): Promise<TokenRead> {
  try {
    const value = await SecureStore.getItemAsync(TOKEN_KEY, OPTIONS)
    if (value) return { ok: true, token: value }
  } catch {
    if (!__DEV__) return { ok: false }
    return readDevFallback()
  }
  if (__DEV__) return readDevFallback()
  return { ok: true, token: null }
}

export async function getToken(): Promise<string | null> {
  const read = await readToken()
  return read.ok ? read.token : null
}

export async function setToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token, OPTIONS)
    return
  } catch (err) {
    if (!__DEV__) throw err
    console.warn(
      "[auth] SecureStore unavailable (unsigned dev build, no keychain entitlement) - " +
        "storing session token in MMKV fallback. Sign with a development team to use the Keychain.",
      err,
    )
    storage.set(TOKEN_KEY, token)
  }
}

function clearDevFallback(): void {
  try {
    storage.delete(TOKEN_KEY)
  } catch {
    return
  }
}

async function clearSecureToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY, OPTIONS)
  } catch (err) {
    console.warn("[auth] the session token could not be deleted from the keychain", err)
  }
}

export async function clearToken(): Promise<void> {
  await clearSecureToken()
  if (__DEV__) clearDevFallback()
}
