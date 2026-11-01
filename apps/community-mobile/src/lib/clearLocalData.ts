import { clearPersistentStorage, resetPersistedStores } from "@civfix/ui"
import { resolveActiveLocale } from "@/lib/locale"
import { clearAppStorage } from "@/lib/mmkv"
import { useAppearanceStore } from "@/store/appearanceStore"
import { useAuthStore } from "@/store/authStore"
import { useLocationPrimerStore } from "@/store/locationPrimerStore"
import { useOnboardingStore } from "@/store/onboardingStore"
import { usePrefsStore } from "@/store/prefsStore"

// The normal sign-out first: it needs the stored push registration and the session to release them on the
// server. The device id and the storage-env marker live in SecureStore, outside what is cleared here.
export async function clearAllLocalDataAndSignOut(): Promise<void> {
  await useAuthStore.getState().signOut()
  // A persisted store writes its whole saved state back on its next set, so each one's memory returns to a
  // fresh install's before the storage under it is emptied. The tour waits for the next launch, as Reset
  // onboarding does, rather than opening over the map now.
  useOnboardingStore.getState().resetForNextLaunch()
  useLocationPrimerStore.getState().reset()
  useAppearanceStore.setState({ preference: useAppearanceStore.getInitialState().preference })
  resetPersistedStores()
  clearAppStorage()
  clearPersistentStorage()
  usePrefsStore.getState().setInitialLocale(resolveActiveLocale(null))
}
