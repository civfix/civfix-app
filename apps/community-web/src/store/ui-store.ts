"use client"

import { create } from "zustand"

/**
 * Ephemeral UI state shared across the home shell: the auth modal. Kept separate from domain stores so
 * opening a dialog never invalidates data caches. (The bottom sheet is owned by the shared AppShell.)
 */
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
