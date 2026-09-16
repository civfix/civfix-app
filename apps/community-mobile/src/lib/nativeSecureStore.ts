import { MMKV } from "react-native-mmkv"
import * as SecureStore from "expo-secure-store"
import * as Crypto from "expo-crypto"
import type { SecureStoreCapability } from "@civfix/ui/capabilities"
import type { KeyValueStore } from "@/lib/mmkv"
import { mintSecureBlobKey, normalizeSecureBlobKey } from "@/lib/secureBlobKey"
import { scopeStorageId } from "@/lib/storageScope"
import { API_URL } from "@/config"

const ENCRYPTION_KEY_ITEM = scopeStorageId("civfix.secure-blobs.key", API_URL)
const INSTANCE_ID = scopeStorageId("civfix.secure", API_URL)

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
}

interface SecureBlobStore extends KeyValueStore {
  clearAll(): void
}

function memoryStore(): SecureBlobStore {
  const map = new Map<string, string>()
  return {
    getString: (key) => map.get(key),
    set: (key, value) => {
      map.set(key, value)
    },
    delete: (key) => {
      map.delete(key)
    },
    clearAll: () => map.clear(),
  }
}

async function encryptionKey(): Promise<string | null> {
  const existing = normalizeSecureBlobKey(await SecureStore.getItemAsync(ENCRYPTION_KEY_ITEM, OPTIONS))
  if (existing) return existing
  const minted = mintSecureBlobKey((count) => Crypto.getRandomBytes(count))
  if (!minted) return null
  await SecureStore.setItemAsync(ENCRYPTION_KEY_ITEM, minted, OPTIONS)
  return minted
}

let opening: Promise<SecureBlobStore> | null = null

function openStore(): Promise<SecureBlobStore> {
  opening ??= (async () => {
    try {
      const key = await encryptionKey()
      if (key) return new MMKV({ id: INSTANCE_ID, encryptionKey: key })
    } catch (err) {
      console.warn(
        "[secure-store] the keychain is unavailable; capability blobs stay in memory for this session",
        err,
      )
    }
    return memoryStore()
  })()
  return opening
}

export async function clearSecureBlobs(): Promise<void> {
  try {
    const store = await openStore()
    store.clearAll()
  } catch (err) {
    console.warn("[secure-store] the capability blobs could not be cleared", err)
  }
}

export const nativeSecureStore: SecureStoreCapability = {
  async get(key: string): Promise<string | null> {
    const store = await openStore()
    return store.getString(key) ?? null
  },

  async set(key: string, value: string): Promise<void> {
    const store = await openStore()
    store.set(key, value)
  },

  async del(key: string): Promise<void> {
    const store = await openStore()
    store.delete(key)
  },
}
