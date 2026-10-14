import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import {
  DEFAULT_APPEARANCE_PREFERENCE,
  isAppearancePreference,
  type AppearancePreference,
} from "@civfix/ui/theme"
import { mmkvStateStorage } from "@/lib/mmkv"
import { APPEARANCE_KEY } from "@/lib/mmkvKeys"

export interface AppearanceState {
  preference: AppearancePreference
  setPreference: (preference: AppearancePreference) => void
}

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      preference: DEFAULT_APPEARANCE_PREFERENCE,
      setPreference: (preference) => set({ preference }),
    }),
    {
      name: APPEARANCE_KEY,
      version: 1,
      storage: createJSONStorage(() => mmkvStateStorage),
      partialize: (state) => ({ preference: state.preference }),
      merge: (persisted, current) => {
        const stored = (persisted as Partial<AppearanceState> | undefined)?.preference
        return {
          ...current,
          preference: isAppearancePreference(stored) ? stored : DEFAULT_APPEARANCE_PREFERENCE,
        }
      },
    },
  ),
)
