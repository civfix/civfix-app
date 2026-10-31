import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import { mmkvStateStorage } from "@/lib/mmkv"
import { ONBOARDING_KEY } from "@/lib/mmkvKeys"

export const ONBOARDING_VERSION = 1

export interface OnboardingState {
  completedVersion: number
  replayRequested: boolean
  presenting: boolean
  gateActive: boolean
  resetPending: boolean
  complete: () => void
  replay: () => void
  setPresenting: (value: boolean) => void
  setGateActive: (value: boolean) => void
  resetForNextLaunch: () => void
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      completedVersion: 0,
      replayRequested: false,
      presenting: false,
      gateActive: true,
      resetPending: false,
      complete: () =>
        set({ completedVersion: ONBOARDING_VERSION, replayRequested: false, resetPending: false }),
      replay: () => set({ replayRequested: true }),
      setPresenting: (value) => set({ presenting: value }),
      setGateActive: (value) => set({ gateActive: value }),
      resetForNextLaunch: () => set({ resetPending: true }),
    }),
    {
      name: ONBOARDING_KEY,
      version: 1,
      storage: createJSONStorage(() => mmkvStateStorage),
      // The gate reads completedVersion live, so a reset changes only what the next launch reads; this
      // session keeps its completion, and every later write keeps storing the reset until a tour finishes.
      partialize: (state) => ({
        completedVersion: state.resetPending ? 0 : state.completedVersion,
      }),
    },
  ),
)
