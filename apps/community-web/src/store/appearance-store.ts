"use client"

import { create } from "zustand"
import {
  DEFAULT_APPEARANCE_PREFERENCE,
  isAppearancePreference,
  type AppearancePreference,
} from "@civfix/ui/theme"

import { APPEARANCE_STORAGE_KEY } from "@/lib/appearance-script"

function readStoredPreference(): AppearancePreference {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE_PREFERENCE
  try {
    const stored = window.localStorage.getItem(APPEARANCE_STORAGE_KEY)
    return isAppearancePreference(stored) ? stored : DEFAULT_APPEARANCE_PREFERENCE
  } catch {
    return DEFAULT_APPEARANCE_PREFERENCE
  }
}

function writeStoredPreference(preference: AppearancePreference): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, preference)
  } catch {
  }
}

export interface AppearanceState {
  preference: AppearancePreference
  setPreference: (preference: AppearancePreference) => void
}

export const useAppearanceStore = create<AppearanceState>((set) => ({
  preference: readStoredPreference(),
  setPreference: (preference) => {
    writeStoredPreference(preference)
    set({ preference })
  },
}))
