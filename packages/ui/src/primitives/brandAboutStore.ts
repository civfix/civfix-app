import { create } from "zustand"

// Shared surfaces request the About modal; hosts present it, so no shared code imports host code.
interface BrandAboutState {
  open: boolean
  setOpen: (open: boolean) => void
}

export const useBrandAboutStore = create<BrandAboutState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))

export type BrandAboutPresenter = () => void

let presentBrandAbout: BrandAboutPresenter | null = null

export function setBrandAboutPresenter(present: BrandAboutPresenter | null): void {
  presentBrandAbout = present
}

export function openBrandAbout(): void {
  if (presentBrandAbout) {
    presentBrandAbout()
    return
  }
  useBrandAboutStore.getState().setOpen(true)
}
