"use client"

import { create } from "zustand"

/** Separate from the domain stores so opening a dialog never invalidates data caches. */
export interface UiState {
  authModalOpen: boolean
  openAuthModal: () => void
  setAuthModalOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  authModalOpen: false,
  openAuthModal: () => set({ authModalOpen: true }),
  setAuthModalOpen: (open) => set({ authModalOpen: open }),
}))
