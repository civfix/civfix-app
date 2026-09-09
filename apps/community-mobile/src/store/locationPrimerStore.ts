import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { mmkvStateStorage } from "@/lib/mmkv"
import { LOCATION_PRIMER_KEY } from "@/lib/mmkv-keys"

interface LocationPrimerState {
  shown: boolean
  markShown: () => void
}

export const useLocationPrimerStore = create<LocationPrimerState>()(
  persist(
    (set) => ({
      shown: false,
      markShown: () => set({ shown: true }),
    }),
    {
      name: LOCATION_PRIMER_KEY,
      version: 1,
      storage: createJSONStorage(() => mmkvStateStorage),
      partialize: (state) => ({ shown: state.shown }),
    },
  ),
)
