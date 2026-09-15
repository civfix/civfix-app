import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { mmkvStateStorage } from "@/lib/mmkv"
import { LOCATION_PRIMER_KEY } from "@/lib/mmkv-keys"

export type LocationChoice = "precise" | "approximate"

interface LocationPrimerState {
  shown: boolean
  choice: LocationChoice | null
  markShown: () => void
  setChoice: (choice: LocationChoice) => void
}

export const useLocationPrimerStore = create<LocationPrimerState>()(
  persist(
    (set) => ({
      shown: false,
      choice: null,
      markShown: () => set({ shown: true }),
      setChoice: (choice) => set({ choice, shown: true }),
    }),
    {
      name: LOCATION_PRIMER_KEY,
      version: 2,
      storage: createJSONStorage(() => mmkvStateStorage),
      partialize: (state) => ({ shown: state.shown, choice: state.choice }),
    },
  ),
)
