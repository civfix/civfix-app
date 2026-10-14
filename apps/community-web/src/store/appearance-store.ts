"use client"

import { create } from "zustand"
import {
  DEFAULT_APPEARANCE_PREFERENCE,
  isAppearancePreference,
  type AppearancePreference,
} from "@civfix/ui/theme"

import { APPEARANCE_STORAGE_KEY } from "@/lib/appearance-script"
import { safeGet, safeSet } from "@/lib/browser-storage"

function readStoredPreference(): AppearancePreference {
  const stored = safeGet("local", APPEARANCE_STORAGE_KEY)
  return isAppearancePreference(stored) ? stored : DEFAULT_APPEARANCE_PREFERENCE
}

export interface AppearanceState {
  preference: AppearancePreference
  setPreference: (preference: AppearancePreference) => void
}

export const useAppearanceStore = create<AppearanceState>((set) => ({
  preference: readStoredPreference(),
  setPreference: (preference) => {
    safeSet("local", APPEARANCE_STORAGE_KEY, preference)
    set({ preference })
  },
}))
