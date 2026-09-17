import * as SecureStore from "expo-secure-store"
import { API_URL } from "@/config"
import { clearToken } from "@/auth/storage"
import { clearAppStorage } from "@/lib/mmkv"
import { clearSecureBlobs } from "@/lib/nativeSecureStore"
import { storageNamespace } from "@/lib/storageScope"
import {
  PROD_STORAGE_ENV,
  STORAGE_ENV_MARKER_KEY,
  purgesLegacyStorage,
  storageEnvFor,
} from "@/lib/storageEnvMarker"
import { queryClient } from "@/query/client"
import { clearPersistedCache, resumeCachePersistence } from "@/query/mmkv-persister"

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
}

async function readMarker(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(STORAGE_ENV_MARKER_KEY, OPTIONS)
  } catch {
    return null
  }
}

async function writeMarker(value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_ENV_MARKER_KEY, value, OPTIONS)
  } catch {
    return
  }
}

async function purge(): Promise<void> {
  await clearToken()
  clearPersistedCache()
  clearAppStorage()
  await clearSecureBlobs()
  queryClient.clear()
  resumeCachePersistence()
}

export async function adoptStorageEnvironment(): Promise<boolean> {
  const namespace = storageNamespace(API_URL)
  const marker = await readMarker()
  const purged = purgesLegacyStorage(namespace, marker)
  if (purged) await purge()
  const next = storageEnvFor(namespace)
  if (marker !== next) await writeMarker(next)
  if (__DEV__) {
    console.log(
      `[storage-env] namespace="${namespace || PROD_STORAGE_ENV}" previous=${marker ?? "<none>"} ` +
        `purgedLegacyIds=${purged}`,
    )
  }
  return purged
}
