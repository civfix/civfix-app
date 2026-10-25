import { clearPersistentStorage } from "@civfix/ui"
import { clearAppStorage } from "@/lib/mmkv"
import { useAuthStore } from "@/store/authStore"

// The normal sign-out first: it needs the stored push registration and the session to release them on the
// server. The device id and the storage-env marker live in SecureStore, outside what is cleared here.
export async function clearAllLocalDataAndSignOut(): Promise<void> {
  await useAuthStore.getState().signOut()
  clearAppStorage()
  clearPersistentStorage()
}
