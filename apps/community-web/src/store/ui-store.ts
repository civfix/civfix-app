"use client"

import { create } from "zustand"

/** Separate from the domain stores so opening a dialog never invalidates data caches. */
export interface UiState {
  authModalOpen: boolean
  /** Where the gated action that opened the modal wants OAuth to come back to (see oauthReturnPath). */
  authModalReturnPath: string | null
  openAuthModal: () => void
  openAuthModalReturningTo: (returnPath: string) => void
  setAuthModalOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  authModalOpen: false,
  authModalReturnPath: null,
  openAuthModal: () => set({ authModalOpen: true, authModalReturnPath: null }),
  openAuthModalReturningTo: (returnPath) => set({ authModalOpen: true, authModalReturnPath: returnPath }),
  setAuthModalOpen: (open) => set({ authModalOpen: open }),
}))
