import { create } from "zustand"

/**
 * Shared open-state for the "About civfix" modal (BrandAboutCard).
 *
 * The card's PRESENTATION is host-owned (web renders <BrandAboutCard/> in an overlay slot; native mounts
 * it as a route), but a SHARED surface needs to REQUEST it open - the map-controls brand pill, in both
 * orientations (in landscape it sits beside the rail, right of the shell's left edge). This tiny store
 * decouples "open the About modal" from where it is presented, so a shared surface can ask for it without
 * importing host code.
 */
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

/** Request the "About civfix" modal open (observed by the host presentation). */
export function openBrandAbout(): void {
  if (presentBrandAbout) {
    presentBrandAbout()
    return
  }
  useBrandAboutStore.getState().setOpen(true)
}
