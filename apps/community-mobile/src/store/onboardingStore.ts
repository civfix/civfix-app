import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { mmkvStateStorage } from "@/lib/mmkv"
import { ONBOARDING_KEY } from "@/lib/mmkv-keys"

export const ONBOARDING_VERSION = 1

export interface OnboardingState {
  completedVersion: number
  replayRequested: boolean
  presenting: boolean
  gateActive: boolean
  complete: () => void
  replay: () => void
  setPresenting: (value: boolean) => void
  setGateActive: (value: boolean) => void
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      completedVersion: 0,
      replayRequested: false,
      presenting: false,
      gateActive: true,
      complete: () => set({ completedVersion: ONBOARDING_VERSION, replayRequested: false }),
      replay: () => set({ replayRequested: true }),
      setPresenting: (value) => set({ presenting: value }),
      setGateActive: (value) => set({ gateActive: value }),
    }),
    {
      name: ONBOARDING_KEY,
      version: 1,
      storage: createJSONStorage(() => mmkvStateStorage),
      partialize: (state) => ({ completedVersion: state.completedVersion }),
    },
  ),
)
