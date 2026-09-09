import { create } from "zustand"

export interface CreateMenuAnchor {
  x: number
  y: number
  width: number
  height: number
}

export interface CreateMenuState {
  open: boolean
  anchor: CreateMenuAnchor | null
  toggle: (anchor: CreateMenuAnchor | null) => void
  close: () => void
}

export const useCreateMenuStore = create<CreateMenuState>((set) => ({
  open: false,
  anchor: null,
  toggle: (anchor) => set((state) => (state.open ? { open: false } : { open: true, anchor })),
  close: () => set({ open: false }),
}))
