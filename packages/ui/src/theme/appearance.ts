import { useSyncExternalStore } from "react"
import { DEFAULT_APPEARANCE_PREFERENCE, type AppearancePreference } from "./schemes"

export interface AppearancePreferenceStore {
  get(): AppearancePreference
  set(preference: AppearancePreference): void
  subscribe(listener: () => void): () => void
}

export function makeMemoryAppearanceStore(
  initial: AppearancePreference = DEFAULT_APPEARANCE_PREFERENCE,
): AppearancePreferenceStore {
  let current = initial
  const listeners = new Set<() => void>()
  return {
    get: () => current,
    set: (preference) => {
      if (preference === current) return
      current = preference
      for (const notify of listeners) notify()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

const memoryStore = makeMemoryAppearanceStore()
let registered: AppearancePreferenceStore | null = null
const registrationListeners = new Set<() => void>()

function activeStore(): AppearancePreferenceStore {
  return registered ?? memoryStore
}

export function setAppearancePreferenceStore(store: AppearancePreferenceStore | null): void {
  if (store === registered) return
  registered = store
  for (const notify of registrationListeners) notify()
}

export function getAppearancePreference(): AppearancePreference {
  return activeStore().get()
}

export function setAppearancePreference(preference: AppearancePreference): void {
  activeStore().set(preference)
}

function subscribeAppearance(listener: () => void): () => void {
  let unsubscribeStore = activeStore().subscribe(listener)
  const onRegistration = () => {
    unsubscribeStore()
    unsubscribeStore = activeStore().subscribe(listener)
    listener()
  }
  registrationListeners.add(onRegistration)
  return () => {
    unsubscribeStore()
    registrationListeners.delete(onRegistration)
  }
}

export function useAppearancePreference(): AppearancePreference {
  return useSyncExternalStore(subscribeAppearance, getAppearancePreference, getAppearancePreference)
}
